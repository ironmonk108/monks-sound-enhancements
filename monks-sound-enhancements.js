import { ActorSounds } from "./apps/actor-sounds.js";
import { registerSettings } from "./settings.js";
import { MonksSoundEnhancementsAPI } from "./monks-sound-enhancements-api.js";
import { MSE_PlaylistConfig } from "./apps/playlist-config.js";
import { MSE_PlaylistDirectory } from "./apps/playlist-directory.js";
import { soundfileinit } from "./plugins/soundfile.plugin.js"

export let debug = (...args) => {
    if (debugEnabled > 1) console.log("DEBUG: monks-sound-enhancements | ", ...args);
};
export let log = (...args) => console.log("monks-sound-enhancements | ", ...args);
export let warn = (...args) => {
    if (debugEnabled > 0) console.warn("monks-sound-enhancements | ", ...args);
};
export let error = (...args) => console.error("monks-sound-enhancements | ", ...args);
export let i18n = key => {
    return game.i18n.localize(key);
};

export let setting = key => {
    return game.settings.get("monks-sound-enhancements", key);
};

export let patchFunc = (prop, func, type = "WRAPPER") => {
    if (game.modules.get("lib-wrapper")?.active) {
        libWrapper.register("monks-sound-enhancements", prop, func, type);
    } else {
        const oldFunc = eval(prop);
        eval(`${prop} = function (event) {
            return func.call(this, ${type != "OVERRIDE" ? "oldFunc.bind(this)," : ""} ...arguments);
        }`);
    }
}

export class MonksSoundEnhancements {
    static tracker = false;
    static tokenbar = null;
    static sounds = {};

    static emit(action, args = {}) {
        args.action = action;
        args.senderId = game.user.id
        game.socket.emit(MonksSoundEnhancements.SOCKET, args, (resp) => { });
    }

    static async onMessage(data) {
        switch (data.action) {
            case 'stop': {
                try {
                    let token = fromUuidSync(data.uuid)
                    if (token) {
                        if (token.soundeffect?.playing) {
                            token.soundeffect.fade(0, { duration: 250 }).then(() => {
                                token.soundeffect.stop();
                                delete token.soundeffect;
                            });
                        } else
                            delete token.soundeffect;
                    }
                } catch { }
            } break;
            case 'play': {
                if (game.user.id != data.senderId) {
                    try {
                        let token = fromUuidSync(data.uuid);
                        if (!token.soundeffect) {
                            ActorSounds.playSoundEffect(data.audiofile, data.volume * game.settings.get("core", "globalSoundEffectVolume")).then((sound) => {
                                if (sound) {
                                    sound.name = token.name;
                                    MonksSoundEnhancements.addSoundEffect(sound);
                                    token.soundeffect = sound;
                                    token.soundeffect.addEventListener("stop", () => {
                                        delete token.soundeffect;
                                    });
                                    token.soundeffect.addEventListener("end", () => {
                                        delete token.soundeffect;
                                    });
                                    token.soundeffect.effectiveVolume = data.volume;
                                    return sound;
                                }
                            });
                        }
                    } catch { }
                }
            } break;
            case 'render': {
                game.playlists.render();
            } break;
        }
    }

    static init() {
        registerSettings();

        game.MonksSoundEnhancements = MonksSoundEnhancementsAPI;

        MonksSoundEnhancements.SOCKET = "module.monks-sound-enhancements";

        CONFIG.TextEditor.enrichers.push({ id: 'MonksSoundEnhancementsSound', pattern: new RegExp(`@Sound\\[([^\\]]+)\\](?:{([^}]+)})?`, 'g'), enricher: MonksSoundEnhancements._createSoundLink });

        foundry.applications.apps.DocumentSheetConfig.unregisterSheet(Playlist, "core", foundry.applications.sheets.PlaylistConfig);
        foundry.applications.apps.DocumentSheetConfig.registerSheet(Playlist, "monks-sound-enhancement", MSE_PlaylistConfig, {
            label: "Playlist Config"
        });

        CONFIG.ui.playlists = MSE_PlaylistDirectory;

        try {
            Object.defineProperty(User.prototype, "isTheGM", {
                get: function isTheGM() {
                    return this == (game.users.find(u => u.hasRole("GAMEMASTER") && u.active) || game.users.find(u => u.hasRole("ASSISTANT") && u.active));
                }
            });
        } catch { }

        if (setting("actor-sounds") === 'false') game.settings.set("monks-sound-enhancements", "actor-sounds", "none");
        if (setting("actor-sounds") === 'true') game.settings.set("monks-sound-enhancements", "actor-sounds", "npc");

        if (setting("actor-sounds"))
            ActorSounds.init();
    }

    static _createSoundLink(match) {
        let [options, name] = match.slice(1, 5);
        let [target, ...props] = options.split(' ');
        const data = {
            cls: ["sound-link"],
            icon: 'fas fa-volume-up',
            dataset: {},
            name: name
        };

        data.name = data.name || target;
        data.dataset = {
            src: target
        };
        if (props[0] == "allowpause")
            data.dataset.allowpause = true;

        const a = document.createElement("a");
        a.classList.add(...data.cls);
        a.draggable = true;
        for (let [k, v] of Object.entries(data.dataset)) {
            a.dataset[k] = v;
        }
        a.innerHTML = `<i class="${data.icon}"></i> ${data.name}`;

        return a;
    }

    static async _onClickSoundLink(event) {
        event.preventDefault();
        const a = event.currentTarget;

        let audio = a.nextElementSibling;
        if (!audio || audio.tagName != "AUDIO") {
            audio = document.createElement("audio");
            audio.src = a.dataset.src;
            audio.volume = game.settings.get("core", "globalSoundEffectVolume");
            a.insertAdjacentElement("afterend", audio);
        }

        if (audio) {
            if (audio.paused)
                audio.play();
            else {
                audio.pause();
                if (a.dataset.allowpause !== "true")
                    audio.currentTime = 0;
            }
        }
    }

    static ready() {
        game.socket.on(MonksSoundEnhancements.SOCKET, MonksSoundEnhancements.onMessage);

        tinyMCE.PluginManager.add('soundeffect', soundfileinit);

        ui.playlists._currentExpanded = true;

        ui.playlists.options.renderUpdateKeys.push("flags");
    }

    static addSoundEffect(sound) {
        if (sound) {
            let id = foundry.utils.randomID(16);
            let _soundStop = () => {
                delete MonksSoundEnhancements.sounds[id];
                ui.playlists.render({parts: ["soundeffects"]});
                if (Object.keys(MonksSoundEnhancements.sounds).length == 0) {
                    window.clearInterval(MonksSoundEnhancements.updateId);
                    MonksSoundEnhancements.updateId = null;
                }
            }
            sound.addEventListener("stop", _soundStop);
            sound.addEventListener("end", _soundStop);
            MonksSoundEnhancements.sounds[id] = { id, sound };
            ui.playlists.render({parts: ["soundeffects"]});
        }
    }

    static async renderPlaylistSound(app, html, data) {
        // Add drop
        new foundry.applications.ux.DragDrop.implementation({
            dropSelector: ".window-content",
            permissions: {
                dragstart: () => false,
                drop: app.isEditable
            },
            callbacks: {
                drop: MonksSoundEnhancements._onDropSound.bind(app)
            }
        }).bind(app.element);

        // Add the check box for hiding the sound names from the players
        $('input[name="fade"]', html).closest(".form-group").after(
            $("<div>").addClass("form-group")
                .append($("<label>").html("Hide name"))
                .append($("<div>").addClass("form-fields")
                    .append($("<input>").attr("type", "checkbox").attr("name", "flags.monks-sound-enhancements.hide-name").prop("checked", foundry.utils.getProperty(app.document, "flags.monks-sound-enhancements.hide-name"))
                ))
        );

        app.setPosition({ height: 'auto' });
    }

    static async _onDropSound(event) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);

        if (data.type == "PlaylistSound") {
            // Reference the target playlist and sound elements
            const sound = await fromUuid(data.uuid);

            //fill in the information on the form with the sound information
            for (let key of ["description", "fade", "flags.monks-sound-enhancements.hide-name", "name", "path", "repeat", "volume"]) {
                let elem = $(this.element).find(`[name="${key}"]`);
                if (elem[0].type == "checkbox")
                    elem.prop("checked", foundry.utils.getProperty(sound, key) ?? false);
                else
                    elem.val(foundry.utils.getProperty(sound, key));
            }
        }
    }

    static hotbarDrop(app, data, slot) {
        if (data.type === "PlaylistSound" || data.type === "Playlist") {
            const doc = fromUuidSync(data.uuid)
            if (!doc) return;

            const name = doc.name || `${game.i18n.localize(doc.constructor.metadata.label)} ${doc.id}`;
            const command = `
try {
    const sound = await fromUuid("${data.uuid}");
    if (sound) {
        if (sound instanceof Playlist) {
            if (sound.playing){
                sound.stopAll();
            } else {
                sound.playAll();
            }
        } else {
            if (!sound.playing)
                sound.parent.playSound(sound);
            else
                sound.update({ playing: false, pausedTime: sound.sound.currentTime });
        }
    }
} catch {}
`;
            Macro.implementation.create({
                name: `${game.i18n.localize("Play")} ${name}`,
                type: CONST.MACRO_TYPES.SCRIPT,
                img: "modules/monks-sound-enhancements/icons/music-macro.png",
                command: command
            }).then((macro) => {
                if (macro) game.user.assignHotbarMacro(macro, slot, { fromSlot: data.slot });
            });

            return false;
        }
    }

    static _formatTimestamp(seconds) {
        if (seconds === Infinity) return "∞";
        seconds = seconds ?? 0;
        let minutes = Math.floor(seconds / 60);
        seconds = Math.round(seconds % 60);
        return `${minutes}:${seconds.paddedString(2)}`;
    }
}

Hooks.on("init", MonksSoundEnhancements.init);
Hooks.on("ready", MonksSoundEnhancements.ready);
Hooks.on('renderPlaylistSoundConfig', MonksSoundEnhancements.renderPlaylistSound);
Hooks.on('hotbarDrop', MonksSoundEnhancements.hotbarDrop);

Hooks.on("updateCombat", (combat, delta) => {
    if (combat.round == combat._mse_round && combat.combatant?.id == combat._mse_turn)
        return;

    if (setting("playsound-combat") && game.user.isTheGM && combat && combat.started === true) {
        if (combat.previous?.combatantId) {
            let previous = combat.combatants.get(combat.previous.combatantId);
            if (previous) {
                previous.token?.playSound({ action: "stop" });
            }
        }
        combat.combatant.token?.playSound();
    }

    combat._mse_round = combat.round;
    combat._mse_turn = combat.combatant?.id;
});

Hooks.on("globalSoundEffectVolumeChanged", (volume) => {
    for (let sound of Object.values(MonksSoundEnhancements.sounds)) {
        if (sound.sound?.playing) {
            sound.sound.volume = (sound.sound.effectiveVolume ?? 1) * volume;
        }
    }
});

Hooks.on("renderJournalPageSheet", (sheet, html, data) => {
    $("a.sound-link", html).click(MonksSoundEnhancements._onClickSoundLink.bind(sheet));
});
