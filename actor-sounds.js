import { MonksSoundEnhancements, i18n, log, setting } from "./monks-sound-enhancements.js";

export class ActorSounds {
    static init() {
        Hooks.on('renderTokenHUD', async (app, html, options) => {
            if (setting("actor-sounds") == "none" || (setting("actor-sounds") == "npc" && app.object.actor?.type == "character")) return;

            let soundEffect = foundry.utils.getProperty(app.object, "actor.flags.monks-sound-enhancements.sound-effect");
            if (!soundEffect) {
                soundEffect = foundry.utils.getProperty(app.object, "actor.flags.monks-little-details.sound-effect");
                if (soundEffect)
                    await app.object.actor.setFlag("monks-sound-enhancements", "sound-effect", soundEffect);
            }
            if (soundEffect != undefined) {
                let icon = 'speaker-on.png';
                if (app.object?.document.soundeffect && app.object?.document.soundeffect?.playing)
                    icon = 'speaker-off.png';

                $('.col.right', html).append(
                    $('<div>').addClass('control-icon sound-effect')
                        .append(`<img src="modules/monks-sound-enhancements/icons/${icon}" width="36" height="36" title="Play Sound Effect">`)
                        .click(ActorSounds.ActorPlay.bind(this, app.object.document)));
            }
        });

        TokenDocument.prototype.playSound = function(options) {
            ActorSounds.loadSoundEffect(this, options);
        }

        Item.prototype.playSound = function (options) {
            ActorSounds.loadSoundEffect(this, options);
        }

        Actor.prototype.addSound = function (audiofile, volume = 1) {
            this.setFlag('monks-sound-enhancements', 'sound-effect', audiofile);
            this.setFlag('monks-sound-enhancements', 'volume', volume);
        }
    }

    static injectSoundCtrls() {
        if (setting("actor-sounds") !== "none") {
            let sheetNames = ["ActorSheet", "ActorSheetV2"];

            if (setting("actor-sounds") === "npc") {
                let npcObject;
                if (game.system.id == 'ds4') {
                    npcObject = CONFIG.Actor.sheetClasses.creature;
                } else
                    npcObject = (CONFIG.Actor.sheetClasses.npc || CONFIG.Actor.sheetClasses.minion);
                if (npcObject != undefined) {
                    sheetNames = Object.values(npcObject)
                        .map((sheetClass) => sheetClass.cls)
                        .map((sheet) => sheet.name);
                }
            }

            sheetNames.forEach((sheetName) => {
                Hooks.on("render" + sheetName, (app, html, data) => {
                    // only for GMs or the owner of this npc
                    if ((!(app.object instanceof Actor) && !(app.document instanceof Actor)) || !(app.object?.isOwner ?? app.document?.isOwner)) return;

                    // don't add the button multiple times
                    if ($(html).find("#mseCharacterSound").length > 0) return;

                    let soundEffect = foundry.utils.getProperty(app.document, "flags.monks-sound-enhancements.sound-effect");
                    if (!soundEffect) {
                        soundEffect = foundry.utils.getProperty(app.document, "flags.monks-little-details.sound-effect");
                        if (soundEffect)
                            app.document.setFlag("monks-sound-enhancements", "sound-effect", soundEffect);
                    }

                    let hasSound = soundEffect != undefined;

                    let button = $('<button>')
                        .attr('type', "button")
                        .attr('id', "mseCharacterSound")
                        .toggleClass('loaded', hasSound)
                        .html('<i class="fas fa-volume-up"></i>')
                        .click(ActorSounds.showDialog.bind(app, "actor"));

                    let wrap = $('<div class="mseCharacterName"></div>');
                    $(html).find("input[name='name'],h1[data-field-key='name'],div.document-name,input[data-tidy-field='name']").wrap(wrap);
                    $(html).find("input[name='name'],h1[data-field-key='name'],div.document-name,input[data-tidy-field='name']").parent().prepend(button);
                });

                Hooks.on("close" + sheetName, (app, html, data) => {
                    delete app.soundcontext;
                });
            });
        }

        if (setting("item-sounds") !== "none") {
            let actorSheetNames = ["ActorSheet", "ActorSheetV2"];
            let itemSheetNames = ["ItemSheet", "ItemSheetV2"]
            
            itemSheetNames.forEach((sheetName) => {
                Hooks.on("render" + sheetName, (app, html, data) => {
                    // only for GMs or the owner of this npc
                    if (!(app.object?.isOwner ?? app.document?.isOwner)) return;
    
                    // don't add the button multiple times
                    if ($(html).find("#mseItemSound").length > 0) return;
    
                    let soundEffect = foundry.utils.getProperty(app.document, "flags.monks-sound-enhancements.sound-effect");
    
                    let hasSound = soundEffect != undefined;
    
                    let button = $('<button>')
                        .attr('type', "button")
                        .attr('id', "mseItemSound")
                        .toggleClass('loaded', hasSound)
                        .html('<i class="fas fa-volume-up"></i>')
                        .click(ActorSounds.showDialog.bind(app, "item"));
    
                    let wrap = $('<div class="mseItemName"></div>');
                    $(html).find("input[name='name'],h1[data-field-key='name']").wrap(wrap);
                    $(html).find("input[name='name'],h1[data-field-key='name']").parent().prepend(button);
                });
    
                Hooks.on("close" + sheetName, (app, html, data) => {
                    delete app.soundcontext;
                });
            });

            actorSheetNames.forEach((sheetName) => {
                Hooks.on("render" + sheetName, (app, html, data) => {
                    $('.inventory-list .item-list .item,.inventory-list .items > li').each(function () {
                        let itemId = $(this).attr('data-item-id');
                        let item = data.items.find(i => i._id == itemId);
    
                        let soundEffect = foundry.utils.getProperty(item, "flags.monks-sound-enhancements.sound-effect");
                        if (soundEffect) {
                            $('.item-name h4', this).before($("<a>").addClass('item-sound').html('<i class="fas fa-play"></i>').on("click", ActorSounds.ItemPlay.bind(app, item)));
                        }
                    })
                });
            })

        }
    }

    /*
    static findSoundEffect(event) {
        //Display the filepicker to save a sound
        const current = this.actor.getFlag('monks-little-details', 'sound-effect');
        const fp = new FilePicker({
            type: "audio",
            current: current,
            callback: path => {
                this.actor.setFlag('monks-little-details', 'sound-effect', path);
            },
            top: this.position.top + 40,
            left: this.position.left + 10,
            wildcard: true
        });
        return fp.browse();
    }*/

    static async ActorPlay(doc, event) {
        let result = await ActorSounds.loadSoundEffect(doc, {
            callback: () => {
                //+++ need to make sure this is the same TokenHUD that started the sound, in case it's a long sound file
                $(`#token-hud .control-icon.sound-effect img`).attr('src', 'modules/monks-sound-enhancements/icons/speaker-on.png');
            }
        }, event);
        if (result == "stop")
            $(`#token-hud .control-icon.sound-effect img`).attr('src', 'modules/monks-sound-enhancements/icons/speaker-on.png');
        else
            $(`#token-hud .control-icon.sound-effect img`).attr('src', 'modules/monks-sound-enhancements/icons/speaker-off.png');
    }

    static async ItemPlay(item, event) {
        let that = this;
        let result = await ActorSounds.loadSoundEffect(item, {
            callback: () => {
                $(`.item[data-item-id="${item._id}"] .item-sound i`, that.element).addClass("fa-play").removeClass("fa-stop");
            }
        }, event);
        if (result == "stop")
            $(`.item[data-item-id="${item._id}"] .item-sound i`, this.element).addClass("fa-play").removeClass("fa-stop");
        else
            $(`.item[data-item-id="${item._id}"] .item-sound i`, this.element).addClass("fa-stop").removeClass("fa-play");
    }

    static async loadSoundEffect(token, options = {}, event) {
        let actor = token instanceof Item ? token : token.actor || token;

        if (!actor)
            return;

        if (event != undefined)
            event.preventDefault;

        if (token.soundeffect && options.action != "play") {
            if (token.soundeffect?.playing) {
                token.soundeffect.fade(0, { duration: 250 }).then(() => {
                    token.soundeffect?.stop();
                    delete token.soundeffect;
                });
            } else 
                delete token.soundeffect;
            return "stop";
        }
        if (!token.soundeffect && options.action != "stop") {
            let volume = foundry.utils.getProperty(actor, "flags.monks-sound-enhancements.volume");
            if (!volume) {
                volume = foundry.utils.getProperty(actor, "flags.monks-little-details.volume");
                if (volume)
                    await actor.setFlag("monks-sound-enhancements", "volume", volume);
            }
            if (!volume)
                volume = 1;

            let soundEffect = foundry.utils.getProperty(actor, "flags.monks-sound-enhancements.sound-effect");
            if (!soundEffect) {
                soundEffect = foundry.utils.getProperty(actor, "flags.monks-little-details.sound-effect");
                if (soundEffect)
                    await actor.setFlag("monks-sound-enhancements", "sound-effect", soundEffect);
            }

            const cache = actor._tokenSounds;
            const audiofiles = await ActorSounds.getTokenSounds(soundEffect, cache);

            //audiofiles = audiofiles.filter(i => (audiofiles.length === 1) || !(i === this._lastWildcard));
            if (audiofiles?.length > 0) {
                const audiofile = audiofiles[Math.floor(Math.random() * audiofiles.length)];
                ActorSounds.playSoundEffect(audiofile, volume * game.settings.get("core", "globalSoundEffectVolume")).then((sound) => {
                    if (sound) {
                        sound.name = token.name;
                        MonksSoundEnhancements.addSoundEffect(sound);
                        token.soundeffect = sound;
                        token.soundeffect.addEventListener("stop", () => {
                            MonksSoundEnhancements.emit("stop", { uuid: token.uuid });
                            delete token.soundeffect;
                            if (options?.callback)
                                options.callback();
                        });
                        token.soundeffect.addEventListener("end", () => {
                            delete token.soundeffect;
                            if (options?.callback)
                                options.callback();
                        });
                        token.soundeffect.effectiveVolume = volume;
                        return sound;
                    }
                });
                MonksSoundEnhancements.emit("play", { uuid: token.uuid, audiofile, volume });
            }
            return "play";
        }
    }

    static async playSoundEffect(audiofile, volume) {
        if (!audiofile)
            return new Promise();   //just return a blank promise so anything waiting can connect a then

        return foundry.audio.AudioHelper.play({ src: audiofile, volume: (volume ?? 1) });
    }

    static async getTokenSounds(audiofile, cache) {
        //const audiofile = actor.getFlag('monks-little-details', 'sound-effect');

        if (!audiofile) return;

        if (!audiofile.includes('*')) return [audiofile];
        if (cache) return cache; //actor._tokenSounds) return this._tokenSounds;
        let source = "data";
        let pattern = audiofile;
        const browseOptions = { wildcard: true };

        if (typeof ForgeVTT != "undefined" && ForgeVTT.usingTheForge) {
            source = "forgevtt";
        }

        // Support S3 matching
        if (/\.s3\./.test(pattern)) {
            source = "s3";
            const { bucket, keyPrefix } = FilePicker.parseS3URL(pattern);
            if (bucket) {
                browseOptions.bucket = bucket;
                pattern = keyPrefix;
            }
        }

        // Retrieve wildcard content
        let sounds = [];
        try {
            const content = await FilePicker.browse(source, pattern, browseOptions);
            sounds = content.files;
        } catch (err) {
            ui.notifications.error(err);
        }
        return sounds;
    }

    /*
    static clearSoundEffect(event) {
        this.actor.unsetFlag('monks-little-details', 'sound-effect');
    }
    */

    static async showDialog(type) {
        new ActorSoundDialog(this.object, { type }).render(true);
    }
}

export class ActorSoundDialog extends FormApplication {
    constructor(object, options = {}) {
        super(object, options);
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "actor-sound-dialog",
            classes: ["form"],
            title: i18n("MonksSoundEnhancements.ActorSound"),
            template: "modules/monks-sound-enhancements/templates/actor-sound.html",
            width: 500,
            submitOnChange: false,
            closeOnSubmit: true,
        });
    }

    getData(options = {}) {
        let actor = this.object;

        let volume = foundry.utils.getProperty(actor, "flags.monks-sound-enhancements.volume");
        if (!volume) {
            volume = foundry.utils.getProperty(actor, "flags.monks-little-details.volume");
            if (volume)
                actor.setFlag("monks-sound-enhancements", "volume", volume);
        }
        if (!volume)
            volume = 1;

        let soundEffect = foundry.utils.getProperty(actor, "flags.monks-sound-enhancements.sound-effect");
        if (!soundEffect) {
            soundEffect = foundry.utils.getProperty(actor, "flags.monks-little-details.sound-effect");
            if (soundEffect)
                actor.setFlag("monks-sound-enhancements", "sound-effect", soundEffect);
        }

        let data = foundry.utils.mergeObject(super.getData(options),
            {
                audiofile: soundEffect,
                volume: volume
            }, { recursive: false }
        );

        if (options.type == "item")
            options.title = i18n("MonksSoundEnhancements.ItemSound")

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        $('button[name="submit"]', html).click(this._onSubmit.bind(this));
        $('button[name="play"]', html).click(this.playSound.bind(this));
    }

    /* -------------------------------------------- */

    /** @override */
    async _updateObject(event, formData) {
        let audiofile = formData.audiofile;
        if (audiofile && !audiofile.startsWith("/") && !audiofile.startsWith("http"))
            audiofile = "/" + audiofile;

        this.object.addSound(audiofile, formData.volume);
    }

    async playSound() {
        if (this.soundeffect) {
            if (this.soundeffect.playing)
                this.soundeffect.stop();
            delete this.soundeffect;
            $('button[name="play"] i', this.element).removeClass("fa-stop").addClass("fa-play");
        } else {
            let volume = parseFloat($('input[name="volume"]', this.element).val());
            let soundeffect = $('file-picker[name="audiofile"] > input', this.element).val();
            let sounds = await ActorSounds.getTokenSounds(soundeffect);

            const audiofile = sounds[Math.floor(Math.random() * sounds.length)];

            let that = this;

            ActorSounds.playSoundEffect(audiofile, volume).then((sound) => {
                if (sound) {
                    this.soundeffect = sound;
                    this.soundeffect.addEventListener("end", () => {
                        delete this.soundeffect;
                        $('button[name="play"] i', that.element).addClass("fa-play").removeClass("fa-stop");
                    });
                    $('button[name="play"] i', that.element).addClass("fa-stop").removeClass("fa-play");
                    return sound;
                }
            });
        }
    }
}

Hooks.on("setupTileActions", (app) => {
    if (app.triggerGroups['monks-sound-enhancements'] == undefined)
        app.registerTileGroup('monks-sound-enhancements', "Monk's Sound Enhancements");
    app.registerTileAction('monks-sound-enhancements', 'actor-sound', {
        name: 'Play Actor Sound',
        ctrls: [
            {
                id: "entity",
                name: "Select Entity",
                type: "select",
                subtype: "entity",
                options: { show : ['token', 'within', 'players', 'previous', 'tagger'] },
                restrict: (entity) => { return (entity instanceof Token); },
            }
        ],
        group: 'monks-sound-enhancements',
        fn: async (args = {}) => {
            const { action, tokens } = args;

            let entities = await game.MonksActiveTiles.getEntities(args);
            for (let entity of entities) {
                if (entity instanceof TokenDocument) {
                    entity.playSound();
                }
            }
        },
        content: async (trigger, action) => {
            let entityName = await game.MonksActiveTiles.entityName(action.data?.entity);
            return `<span class="logic-style">${trigger.name}</span> of <span class="entity-style">${entityName}</span>`;
        }
    });
});
