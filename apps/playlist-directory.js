import { MonksSoundEnhancements, i18n, log, debug, setting, patchFunc } from "../monks-sound-enhancements.js";
export class MSE_PlaylistDirectory extends CONFIG.ui.playlists {
    static DEFAULT_OPTIONS = {
        actions: {
            currentExpand: MSE_PlaylistDirectory.onCurrentExpand,
            soundEffectsExpand: MSE_PlaylistDirectory.onSoundEffectsExpand,
            selectSound: MSE_PlaylistDirectory.onSelectSound,
            effectStop: MSE_PlaylistDirectory.onEffectStop,
            playlistMode: () => { } // This is a no-op to prevent the default behavior of switching to playlist mode
        }
    }

    static PARTS = {
        header: super.PARTS.header,
        controls: {
            template: "modules/monks-sound-enhancements/templates/controls.hbs"
        },
        soundeffects: {
            template: "modules/monks-sound-enhancements/templates/soundeffect.hbs",
            templates: ["modules/monks-sound-enhancements/templates/sound-effect-partial.hbs"]
        },
        directory: super.PARTS.directory,
        playing: {
            template: "modules/monks-sound-enhancements/templates/playing.hbs",
            templates: ["modules/monks-sound-enhancements/templates/sound-partial.hbs"]
        },
        footer: super.PARTS.footer
    };

    static _entryPartial = "modules/monks-sound-enhancements/templates/playlist-partial.hbs";

    _playing = {
        context: [],
        playlists: [],
        sounds: []
    };
    _effects = {
        context: [],
        sounds: {}
    };

    _currentExpanded = true;
    _soundEffectsExpanded = true;

    _createContextMenus() {
        super._createContextMenus();

        this._createContextMenu(this._getPlaymodeContextOptions, "button[data-action='playlistMode']", {
            fixed: true,
            hookName: "getPlaymodeContextOptions",
            parentClassHooks: false,
            eventName: "click",
        });
    }


    _preparePlaylistContext(root, playlist) {
        
        let context = super._preparePlaylistContext(root, playlist);

        context.hidden = foundry.utils.getProperty(playlist, "flags.monks-sound-enhancements.hide-playlist");

        if (game.user.isGM && setting("playlist-show-description")) {
            let description = foundry.utils.getProperty(playlist, "description");
            if (description) {
                context.tooltip = description;
            }
        }

        let hideNames = setting("playlist-hide-names");

        context.sounds = context.sounds.map(s => {
            let sound = playlist.sounds.get(s.id);
            s.hidden = (foundry.utils.getProperty(sound?.parent, "flags.monks-sound-enhancements.hide-playlist") && hideNames) || foundry.utils.getProperty(sound, "flags.monks-sound-enhancements.hide-name");
            return s;
        });

        return context;
    }

    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        switch ( partId ) {
          case "soundeffects": await this._prepareSoundEffectsContext(context, options); break;
        }
        return context;
    }


    _prepareControlsContext(context, options) {
        super._prepareControlsContext(context, options);

        const { volumeToInput, volumeToPercentage } = foundry.audio.AudioHelper;

        let soundeffect = volumeToInput(game.settings.get("core", "globalSoundEffectVolume"))

        context.controls.soundeffect = {
            modifier: soundeffect,
            name: "globalSoundEffectVolume",
            field: new foundry.data.fields.NumberField({ min: 0, max: 1, step: .05 }),
            dataset: {
                tooltip: volumeToPercentage(soundeffect)
            },
            aria: {
                label: game.i18n.localize("MonksSoundEnhancements.SoundEffect"),
                valuetext: volumeToPercentage(soundeffect, { label: true })
            }
        }
    }

    async _preparePlayingContext(context, options) {
        super._preparePlayingContext(context, options);
        const top = this.currentlyPlayingLocation === "top";
        context.currentlyPlaying.pin.thumbtack = top ? "" : "-slash";
        if (this._currentExpanded) {
            context.currentlyPlaying.class += " expanded";
        }
    }

    async _prepareSoundEffectsContext(context, options) {
        Object.assign(this._effects, { context: [], sounds: {} });
        const { volumeToInput, volumeToPercentage } = foundry.audio.AudioHelper;

        let sounds = [];
        if (game.user.isGM && Object.keys(MonksSoundEnhancements.sounds).length) {
            // Add the sound effects
            for (let [k, v] of Object.entries(MonksSoundEnhancements.sounds)) {
                const { name, pausedTime, playing, volume } = v.sound;
                const s = {
                    id: k,
                    isOwner: game.user.isGM,
                    name,
                    playing,
                    repeat: false,
                    css: playing ? "playing" : "",
                    play: {
                        icon: `fa-solid fa-square`,
                        label: "Stop Sound"
                    }
                };
                if ( v.sound && !v.sound.failed && (playing || pausedTime) ) {
                    const modifier = volumeToInput(volume);
                    s.volume = {
                        modifier,
                        field: new foundry.data.fields.NumberField({ min: 0, max: 1, step: .05 }),
                        dataset: {
                            tooltip: volumeToPercentage(modifier)
                        },
                        aria: {
                            label: game.i18n.localize("PLAYLIST_SOUND.FIELDS.volume.label"),
                            valuetext: volumeToPercentage(modifier, { label: true })
                        }
                    };
                    s.currentTime = this.constructor.formatTimestamp(playing ? v.sound.currentTime : pausedTime);
                    s.durationTime = this.constructor.formatTimestamp(v.sound.duration);

                    this._effects.context.push(s);
                    this._effects.sounds[s.id] = v.sound;
                }
                sounds.push(s);
            }
        }
        context.soundEffects = {
            class: this._soundEffectsExpanded ? "expanded" : "",
            expanded: this._soundEffectsExpanded,
            sounds
        }
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        if ( options.parts.includes("soundeffects") ) {
            const effects = this.element.querySelector(".sound-effects");
            effects.hidden = !this._effects.context.length;
        }

        $(this.element).toggleClass('sound-enhancement', setting("change-style"));
    }

    static onCurrentExpand(event) {
        event.preventDefault();
        const entry = event.target.closest(".currently-playing");
        entry.classList.toggle("expanded");
        this._currentExpanded = entry.classList.contains("expanded");
    }

    static onSoundEffectsExpand(event) {
        event.preventDefault();
        const entry = event.target.closest(".sound-effects");
        entry.classList.toggle("expanded");
        this._soundEffectstExpanded = entry.classList.contains("expanded");
    }


    static onSelectSound(event) {
        if (game.user.isGM) {
            const soundId = event.currentTarget.closest("li.sound").dataset.soundId;

            const sound = this.document.sounds.get(soundId);
            if (sound) {
                const allowed = Hooks.call("clickPlaylistSound", sound, game.user.id);
                if (!allowed) return;

                if (!sound.playing)
                    this.document.playSound(sound);
                else
                    sound.update({ playing: false, pausedTime: sound.currentTime });
            }
        }
    }

    static onEffectStop(event) {
        const soundId = event.target.closest("li.sound").dataset.soundId;
        const sound = this._effects.sounds[soundId];
        if (sound) {
            sound.stop();
        }
    }

    _onSoundVolume(slider) {
        const li = slider.closest(".sound.effect");
        if (li) {
            const { inputToVolume, volumeToPercentage } = foundry.audio.AudioHelper;
            const soundId = li.dataset.soundId;
            const sound = this._effects.sounds[soundId];

            if (!sound) return;

            const volume = inputToVolume(slider.value);
            if (volume === sound.volume) return;

            sound.fade(volume, { duration: PlaylistSound.VOLUME_DEBOUNCE_MS });
            const tooltip = volumeToPercentage(slider.value);
            const label = volumeToPercentage(slider.value, { label: true });
            slider.dataset.tooltipText = tooltip;
            slider.ariaValueText = label;
            game.tooltip.activate(slider, { text: tooltip });
        } else
            super._onSoundVolume(slider);
    }

    async _onDrop(event) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if (data.type !== "PlaylistSound") return super._onDrop(event);

        await super._onDrop(event);

        if (event.shiftKey) {
            const sound = await fromUuid(data.uuid);
            if (sound) sound.delete();
        }

    }

    _getPlaymodeContextOptions() {
        const modes = Object.values(CONST.PLAYLIST_MODES);
        let menuitems = [];
        for (let modeId of modes) {
            let mode = this.constructor.PLAYLIST_MODES[modeId];
            menuitems.push({
                name: i18n(mode.label),
                icon: `<i class="${mode.icon}"></i>`,
                callback: async (li) => {
                    let playlistId = li.closest(".playlist").dataset.entryId;
                    let playlist = game.playlists.get(playlistId);
                    if (!playlist) return;

                    for (const s of playlist.sounds) s.playing = false;
                    playlist.update({ sounds: playlist.sounds.toJSON(), mode: modeId });
                }
            });
        }
        return menuitems;
    }

    _getEntryContextOptions() {
        let menuitems = super._getEntryContextOptions();
        menuitems.unshift(
            {
                name: i18n("MonksSoundEnhancements.RevealPlaylist"),
                icon: '<i class="fas fa-eye"></i>',
                condition: li => {
                    let id = li.closest(".playlist").dataset.entryId;
                    let playlist = game.playlists.get(id);
                    if (playlist)
                        return game.user.isGM && foundry.utils.getProperty(playlist, "flags.monks-sound-enhancements.hide-playlist");
                    else
                        return false;
                },
                callback: async (li) => {
                    let id = li.closest(".playlist").dataset.entryId;
                    let playlist = game.playlists.get(id);
                    if (playlist) {
                        let result = await playlist.update({ "flags.monks-sound-enhancements.hide-playlist": false });
                        playlist.collection.render();
                        return result;
                    }
                }
            },
            {
                name: i18n("MonksSoundEnhancements.HidePlaylist"),
                icon: '<i class="fas fa-eye-slash"></i>',
                condition: li => {
                    let id = li.closest(".playlist").dataset.entryId;
                    let playlist = game.playlists.get(id);
                    if (playlist)
                        return game.user.isGM && !foundry.utils.getProperty(playlist, "flags.monks-sound-enhancements.hide-playlist");
                    else
                        return false;
                },
                callback: async (li) => {
                    let id = li.closest(".playlist").dataset.entryId;
                    let playlist = game.playlists.get(id);
                    if (playlist) {
                        let result = await playlist.update({ "flags.monks-sound-enhancements.hide-playlist": true });
                        playlist.collection.render();
                        return result;
                    }
                }
            }
        );
        return menuitems;
    }

    _getSoundContextOptions() {
        let menuitems = super._getSoundContextOptions();
        menuitems.unshift(
            {
                name: i18n("MonksSoundEnhancements.RevealSoundName"),
                icon: '<i class="fas fa-eye"></i>',
                condition: li => {
                    let playlist = game.playlists.get(li.dataset.playlistId);
                    let sound = playlist.sounds.get(li.dataset.soundId);
                    return game.user.isGM && foundry.utils.getProperty(sound, "flags.monks-sound-enhancements.hide-name");
                },
                callback: li => {
                    let playlist = game.playlists.get(li.dataset.playlistId);
                    let sound = playlist.sounds.get(li.dataset.soundId);
                    return sound.update({ "flags.monks-sound-enhancements.hide-name": false });
                }
            },
            {
                name: i18n("MonksSoundEnhancements.HideSoundName"),
                icon: '<i class="fas fa-eye-slash"></i>',
                condition: li => {
                    let playlist = game.playlists.get(li.dataset.playlistId);
                    let sound = playlist.sounds.get(li.dataset.soundId);
                    return game.user.isGM && !foundry.utils.getProperty(sound, "flags.monks-sound-enhancements.hide-name");
                },
                callback: li => {
                    let playlist = game.playlists.get(li.dataset.playlistId);
                    let sound = playlist.sounds.get(li.dataset.soundId);
                    return sound.update({ "flags.monks-sound-enhancements.hide-name": true });
                }
            }
        );
        return menuitems;
    }

    updateTimestamps() {
        super.updateTimestamps();
        const effects = document.querySelectorAll(".playlists-sidebar .sound-effects");
        if (!effects.length || !this._effects.context.length) return;
        for (const el of effects) {
            for (let s of this._effects.context) {
                const li = el.querySelector(`.sound[data-sound-id="${s.id}"]`);
                if (!li) continue;

                let sound = this._effects.sounds[s.id];
                if (!sound) continue;

                // Update current and max playback time
                const current = li.querySelector(".current");
                const ct = sound.playing ? sound.currentTime : sound.pausedTime;
                if (current) current.textContent = this.constructor.formatTimestamp(ct);
                const max = li.querySelector(".duration");
                if (max) max.textContent = this.constructor.formatTimestamp(sound.duration);
            }
        }
    }
}