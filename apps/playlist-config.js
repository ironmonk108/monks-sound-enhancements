import { MonksSoundEnhancements, i18n, log, debug, setting, patchFunc } from "../monks-sound-enhancements.js";
export class MSE_PlaylistConfig extends foundry.applications.sheets.PlaylistConfig {
    static DEFAULT_OPTIONS = {
        classes: ["mse-playlist-config"],
        actions: {
            addSound: MSE_PlaylistConfig.onCreateSound,
            deleteSounds: MSE_PlaylistConfig.onDeleteSounds,
            deleteSound: MSE_PlaylistConfig.onDeleteSound,
            playSound: MSE_PlaylistConfig.onPlaySound,
            importDocument: MSE_PlaylistConfig.importDocument
        }
    };

    static PARTS = {
        tabs: { template: "templates/generic/tab-navigation.hbs" },
        playlist: { template: "modules/monks-sound-enhancements/templates/playlist-tab.hbs" },
        sounds: { template: "modules/monks-sound-enhancements/templates/sound-tab.hbs", scrollable: [""] },
        footer: super.PARTS.footer
    };

    static TABS = {
        sheet: {
            tabs: [
                { id: "playlist", icon: "fa-solid fa-music" },
                { id: "sounds", icon: "fa-solid fa-file-audio" },
            ],
            initial: "playlist",
            labelPrefix: "MonksSoundEnhancements.PLAYLIST.TABS"
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        context.id = this.document.id;
        context.uuid = this.document.uuid;

        context.sounds = this.document.sounds
            .filter(s => !!s)
            .map(s => {
                return {
                    id: s.id,
                    name: s.name,
                    sort: s.sort,
                    data: { name: s.name, sort: s.sort },
                    duration: this.getDuration(s)
                }
            })
            .sort(this.document._sortSounds.bind(this.document));

        context.cantAdd = this.document.isEmbedded || this.document.compendium?.locked || !this.document.constructor.canUserCreate(game.user);
        context.cantDelete = this.document.isEmbedded || this.document.compendium?.locked || !game.user.isGM

        context.fields.hideplaylist = new foundry.data.fields.BooleanField({
            gmOnly: true,
            initial: false,
            label: i18n("MonksSoundEnhancements.HidePlaylist"),
            hint: i18n("MonksSoundEnhancements.HidePlaylistHint"),
        }, { name: "flags.monks-sound-enhancements.hide-playlist" });

        return context;
    }

    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (partId in context.tabs) context.tab = context.tabs[partId];
        return context;
    }

    _createContextMenus() {
        this._createContextMenu(this._getSoundContextOptions, ".sound", {
            fixed: true,
            hookName: "getPlaylistSoundContextOptions",
            parentClassHooks: false
        });
    }

    _toggleDisabled(disabled) {
        super._toggleDisabled(disabled);
        $(this.element).find("input[data-action='selectSound']").removeAttr("disabled");
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        this._createContextMenus();
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        new foundry.applications.ux.DragDrop.implementation({
            dragSelector: ".sound .name",
            dropSelector: ".tab.sounds",
            permissions: {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this)
            },
            callbacks: {
                dragstart: this._onDragStart.bind(this),
                drop: this._onDrop.bind(this)
            }
        }).bind(this.element);
    }

    _getSoundContextOptions() {
        let playlist = this.document;
        return [{
            name: "PLAYLIST.SoundEdit",
            icon: '<i class="fa-solid fa-pen-to-square"></i>',
            callback: li => {
                const { soundId } = li.dataset;
                const sheet = playlist.sounds.get(soundId)?.sheet;
                if (!sheet) return;
                const options = { force: true };
                if (!this.isPopout) options.position = {
                    top: li.offsetTop - 24,
                    left: window.innerWidth - ui.sidebar.element.offsetWidth - sheet.options.position.width - 10
                };
                return sheet.render(options);
            }
        }, {
            name: "PLAYLIST.SoundDelete",
            icon: '<i class="fa-solid fa-trash"></i>',
            callback: li => {
                const { soundId } = li.dataset;
                return playlist.sounds.get(soundId)?.deleteDialog({
                    position: {
                        top: Math.min(li.offsetTop, window.innerHeight - 350),
                        left: window.innerWidth - 720
                    }
                });
            }
        }];
    }

    _canDragStart(selector) {
        return true;
    }

    _canDragDrop(selector) {
        return this.isEditable;
    }

    _onDragStart(event) {
        const soundId = event.target.closest(".sound")?.dataset.soundId;

        if (!soundId) return; // No sound to drag

        const sound = this.document.sounds.get(soundId);

        if (!sound) return; // No sound found

        let dragData = sound.toDragData();

        if (!dragData) return;

        // Set data transfer
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    async _onDrop(event) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);

        if (data.type == "PlaylistSound") {
            const sound = await PlaylistSound.implementation.fromDropData(data);

            if (this.document.uuid != sound.parent.uuid) {
                // Copy to a new play list, unless you hold down shift, then it gets moved
                let result = PlaylistSound.implementation.create(sound.toObject(), { parent: this.document });

                if (event.shiftKey) {
                    sound.delete();
                }

                return result;
            } else {
                // Sort within the list
                target = event.target.closest(".sound");
                const targetId = target.dataset.soundId;
                if (!targetId || (targetId === sound.id)) return false;
                return sound.sortRelative({
                    sortKey: "sort",
                    target: this.document.sounds.get(targetId),
                    siblings: this.document.sounds.filter(s => s.id !== sound.id)
                });
            }
        }
    }

    static onCreateSound(event) {
        const sound = new PlaylistSound({ name: game.i18n.localize("SOUND.New") }, { parent: this.document });
        sound.sheet.render({ force: true });
    }

    static onDeleteSound(event) {
        let soundId = event.target.closest('.sound').dataset.soundId;
        const playlist = this.document;
        if (!soundId) return;
        if (!playlist.sounds.has(soundId)) return;

        const sound = playlist.sounds.get(soundId);
        if (!sound) return;

        return sound.deleteDialog();
    }

    static onDeleteSounds(event) {
        const submitData = this._processFormData(null, this.form, new foundry.applications.ux.FormDataExtended(this.form));
        const sounds = submitData.sounds ?? {};

        let selectedIds = Object.entries(sounds).reduce((acc, [key, value]) => {
            if (value.selected) acc.push(key);
            return acc;
        }, []);

        if (selectedIds.length) {
            const type = game.i18n.localize(PlaylistSound.metadata.label);

            return foundry.applications.api.DialogV2.confirm({
                window: {
                    icon: "fa-solid fa-trash",
                    title: `${game.i18n.format("DOCUMENT.Delete", { type })}`
                },
                content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>You're removing ${selectedIds.length} sounds.  These sounds will be permanently deleted and cannot be recovered.</p>`,
                yes: {
                    callback: () => {
                        PlaylistSound.deleteDocuments(selectedIds, { parent: this.document });
                    }
                }
            });
        }
    }

    static async onPlaySound(event) {
        let soundId = event.target.closest('.sound').dataset.soundId;
        const playlist = this.document;
        if (!soundId) return;
        if (!playlist.sounds.has(soundId)) return;

        const sound = playlist.sounds.get(soundId);
        if (!sound) return;

        if (!playlist._sounds)
            playlist._sounds = {};

        /*
        let target = $(event.currentTarget).closest('.item')[0];
        let sound = app._sounds[soundId];
        if (!sound) {
            let playlist;
            if (target.dataset.packId) {
                let pack = game.packs.get(target.dataset.packId);
                playlist = await pack.getDocument(target.dataset.playlistId);
            } else
                playlist = game.playlists.get(target.dataset.playlistId);
            sound = playlist.sounds.get(soundId);
        }
        */

        let playButton = $(`.mse-playlist-config .sound[data-sound-id="${soundId}"] a[data-action="playSound"] i`);

        if (playlist._sounds[soundId]) {
            if (playlist._sounds[soundId] == 'loading') {
                playlist._sounds[soundId] = "stop";
            } else {
                if (playlist._sounds[soundId].playing) {
                    try {
                        playlist._sounds[soundId].stop();
                    } catch { }
                    playButton.attr("data-tooltip", "Play Sound").addClass("fa-play").removeClass("fa-stop active");
                }
                else {
                    await playlist._sounds[soundId].load();
                    playlist._sounds[soundId].play({ volume: 1 });
                    playButton.attr("data-tooltip", "Stop Sound").removeClass("fa-play").addClass("fa-stop active");
                }
            }
        } else {
            playButton.attr("data-tooltip", "Loading Sound").removeClass("fa-play").addClass("fa-sync");
            playlist._sounds[soundId] = 'loading';
            foundry.audio.AudioHelper.play({ src: sound.path, volume: 1, loop: false }, false).then((sound) => {
                sound.addEventListener("stop", () => {
                    playButton.attr("data-tooltip", "Play Sound").addClass("fa-play").removeClass("fa-sync fa-stop active");
                });
                sound.addEventListener("end", () => {
                    playButton.attr("data-tooltip", "Play Sound").addClass("fa-play").removeClass("fa-sync fa-stop active");
                });

                $(`.mse-playlist-config .sound[data-sound-id="${soundId}"] .duration`).html(this.getDuration(sound, true));

                if (playlist._sounds[soundId] == "stop") {
                    playlist._sounds[soundId] = sound;
                    try {
                        sound.stop();
                    } catch { }
                } else {
                    playlist._sounds[soundId] = sound;
                    playButton.attr("data-tooltip", "Stop Sound").removeClass("fa-sync").addClass("fa-stop active");
                }
            });
        }
    }

    getDuration(sound, override = false) {
        if (sound.sound?.duration || sound._duration || sound.duration)
            return MonksSoundEnhancements._formatTimestamp(sound.sound?.duration || sound._duration || sound.duration);

        if (!setting("playsound-duration") || override)
            return '-';

        // Create a non-dom allocated Audio element
        var au = document.createElement('audio');

        // Define the URL of the MP3 audio file
        au.src = sound.path;

        // Once the metadata has been loaded, display the duration in the console
        au.addEventListener('loadedmetadata', function () {
            // Obtain the duration in seconds of the audio file (with milliseconds as well, a float value)
            var duration = au.duration;

            // example 12.3234 seconds
            sound._duration = duration;
            $(`li[data-sound-id="${sound.id}"] .duration`).html(MonksSoundEnhancements._formatTimestamp(duration));
            console.log("The duration of " + sound.path + " is of: " + duration + " seconds");
            // Alternatively, just display the integer value with
            // parseInt(duration)
            // 12 seconds
        }, false);

        return '<i class="fa-solid fa-sync fa-spin"></i>'
    }

    static async importDocument(event) {
        const submitData = this._processFormData(null, this.form, new foundry.applications.ux.FormDataExtended(this.form));
        const sounds = submitData.sounds ?? {};

        let selectedIds = Object.entries(sounds).reduce((acc, [key, value]) => {
            if (value.selected) acc.push(key);
            return acc;
        }, []);

        if (selectedIds.length) {
            let updateData = {sounds: []};
            for (let id of selectedIds) {
                let sound = this.document.sounds.get(id);
                if (sound) {
                    updateData.sounds.push(sound.toObject());
                }
            }

            if (this._importPlaylist) {
                PlaylistSound.implementation.create(updateData.sounds, { parent: this._importPlaylist });
            } else {
                this._importPlaylist = await game.collections.get(this.document.documentName).importFromCompendium(this.document.compendium, this.document.id, updateData);
            }
            $(this.element).find(".sound input[data-action='selectSound']").prop("checked", false);
            return this._importPlaylist;
        } else {
            await this.close();
            const { documentName, collection, id } = this.document;
            return game.collections.get(documentName).importFromCompendium(collection, id);
        }
    }

    async close(options = {}) {
        if (this.document._sounds) {
            for (let sound of Object.values(this.document._sounds)) {
                if (sound.playing)
                    sound.stop();
            }
        }
        return super.close(options);
    }
}