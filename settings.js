import { MonksSoundEnhancements, i18n } from "./monks-sound-enhancements.js"

export const registerSettings = function () {
	// Register any custom module settings here
	let modulename = "monks-sound-enhancements";

	let actorsoundsoptions = {
		'none': i18n("MonksSoundEnhancements.actorsoundsoptions.none"),
		'npc': i18n("MonksSoundEnhancements.actorsoundsoptions.npc"),
		'everyone': i18n("MonksSoundEnhancements.actorsoundsoptions.everyone")
	};

	let itemsoundsoptions = {
		'none': i18n("MonksSoundEnhancements.actorsoundsoptions.none"),
		'everyone': i18n("MonksSoundEnhancements.actorsoundsoptions.everyone")
	};

	game.settings.register(modulename, "change-style", {
		name: i18n("MonksSoundEnhancements.change-style.name"),
		hint: i18n("MonksSoundEnhancements.change-style.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
		onChange: (value) => {
			$('#playlists').toggleClass('sound-enhancement', value);
		}
	});

	game.settings.register(modulename, "actor-sounds", {
		name: i18n("MonksSoundEnhancements.actor-sounds.name"),
		hint: i18n("MonksSoundEnhancements.actor-sounds.hint"),
		scope: "world",
		config: true,
		default: "npc",
		choices: actorsoundsoptions,
		type: String,
		requiresReload: true
	});

	game.settings.register(modulename, "item-sounds", {
		name: i18n("MonksSoundEnhancements.item-sounds.name"),
		hint: i18n("MonksSoundEnhancements.item-sounds.hint"),
		scope: "world",
		config: true,
		default: "everyone",
		choices: itemsoundsoptions,
		type: String,
		requiresReload: true
	});

	game.settings.register(modulename, "playsound-combat", {
		name: i18n("MonksSoundEnhancements.playsound-combat.name"),
		hint: i18n("MonksSoundEnhancements.playsound-combat.hint"),
		scope: "world",
		config: true,
		default: false,
		type: Boolean,
		onChange: () => {
			MonksSoundEnhancements.emit("render");
		}
	});

	game.settings.register(modulename, "playlist-hide-names", {
		name: i18n("MonksSoundEnhancements.playlist-hide-names.name"),
		hint: i18n("MonksSoundEnhancements.playlist-hide-names.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
		onChange: () => {
			MonksSoundEnhancements.emit("render");
		}
	});

	game.settings.register(modulename, "playlist-show-description", {
		name: i18n("MonksSoundEnhancements.playlist-show-description.name"),
		hint: i18n("MonksSoundEnhancements.playlist-show-description.hint"),
		scope: "world",
		config: true,
		default: false,
		type: Boolean,
		onChange: () => {
			game.playlists.render();
		}
	});

	game.settings.register(modulename, "playsound-duration", {
		name: i18n("MonksSoundEnhancements.playsound-duration.name"),
		hint: i18n("MonksSoundEnhancements.playsound-duration.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});

	game.settings.register("core", "globalSoundEffectVolume", {
		name: "Global Sound Effects Volume",
		hint: "Define a global sound effect volume modifier",
		scope: "client",
		config: false,
		default: 0.5,
		type: Number,
		onChange: v => {
			Hooks.callAll("globalSoundEffectVolumeChanged", v);
		}
	});
};