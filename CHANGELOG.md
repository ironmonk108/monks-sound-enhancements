# Version 13.01

v13 Compatibility

Switched the play mode button from cycling through each item to a drop down, so you can actually pick what you want the mode to be.

# Version 12.03

Fixed a bug

# Version 12.02

Fixing issues with the new DnD5e character sheet

Fixing issues with Tidy 5e character sheets

Adding extra API commands

Fixing issues dragging a sound back to a compendium

# Version 12.01

v12 Compatibility

# Version 11.06

Fixing playing item sounds in PF2e

Fixed issue where turning actor sounds off was still showing them

Fixed issues with playing actor sounds on turn not clearing after finished being played, and not respecting the correct volume

Added the option to move sound between playlist while holding the shift key to move them instead of copying them

Fixed issue where embedded sound links weren't rendering unless there was text added

Fixed issue dragging and dropping onto the sound list only working if it was dropped on a sound file

Added the option to show the playlist description as a tooltip

Added specific settings for Item sounds so that it's independant of actor sounds

# Version 11.05

Fixed issue where actor sound effect plays any time a combat updates

# Version 11.04

Fixed issue with sound files attached to an Items

Adding a Sound embedded link to journal entries to allow for playing a sound effect when clicked.  `@Sound[filepath allowpause]{displayed text}

Fixed issue for playing token sound effects if the combatant has no token.

# Version 11.03

Adding support for Multiple Document Selection

# Version 11.02

Added support for v11

Fixed issue with actor sounds not initiating play at the correct volume.

Fixed issue where players weren't able to adjust the volume of sound effects

Fixed issue with hiding and revealing playlists using the context menu

# Version 10.03

Fixed support for changes to Active Tiles.

Fixed issues with changing the play and stop buttons to reflect the state of the audio file.

# Version 10.02

Changed the icons in the token HUD to be a little more pleasing to the eye.

Changed to have the actor sound attached to the token document rather than the token itself.
*NOTE* This will also affect any macros that use tokens to play the actor sound effect.  They'll need to reference the token document instead.

Added a global Sound Effects volume slider to handle all sounds that don't quite fit into the core volume sliders.

Added an API for sound enhancements to allow other modules to add a sound effect to the currently playing list. (Expect Enhanced Journals and Active Tiles to begin using it on their next updates)

Fixed issues with loading actor sound effects, allowed the option to specify what you want to do, rather than just toggling the sound being played.

Fixed issues with actor sounds being stopped instead of just ending naturally.

Added the option to expand and collapse the currently playing.  And changed the pin icon to an actual pin.

Excluded syrinscape sounds from the sound enhancements to the edit playlist sound config.

Allow sounds to be added to a compendium playlist, provided it's unlocked.

Showed on the play list when sound names are hidden from players.

Added the option to hide entire playlist from the players when they have a song currently playing from them.  Turning this on will automatically hide the name od the sound file in the currently playing.

Hid the sound controls from players that can't control sounds, since there's no reason for them to be there.

Updated the action to drop a playlist on the Hotbar.  Instead of creating a macro that opens the playlist config, it will now generate a Macro to start the playlist or playlist sound playing.

Added the duration to the sound listing when editing the playlist.

Added context menu items to hide and reveal sounds and playlist.

Added the option to play an actor sound when it's their turn in combat.

# Version 10.1

Moved Actor sounds from Monk's Little Details to Sound Enhancements.

Added sound enhancements to Items, so you can have a musical instrument play a sound effect.

Added styling to the popped out sound directory

Added the option to hide the playlist name from players

# Version 1.0.4

Adding v10 support.

# Version 1.0.3

Added additional stylings to make it clearer what sound tracks are playing.

# Version 1.0.2

Looks like the refresh and delete issue were Foundry related.  It's been fixed in 9.268 so I'm removing it from my code.

Added the option to editing a playlist and select multiple tracks to delete, rather than having to click on each one individually to delete.

# Version 1.0.1

Fixed Foundry issues with updating a playlist when sounds have been added.

Fixed issues with dragging and dropping a sound file from a Compendium onto a Playlist

Added the option to add a sound from the Playlist edit config

Added the option to drag and drop a sound file onto the Sound Config dialog to update with the dropped sounds information.

Fixed an issue where it would try and stop sounds on a playlist that had no sounds.