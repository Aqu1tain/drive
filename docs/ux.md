**English** · [Français](ux.fr.md)

# UX notes

A consistency guardrail. Every new interface must follow it, or update it.

## Patterns studied → adopted

| Source | Pattern | Adopted because |
|---|---|---|
| Google Drive | Central search, filter chips, list/grid views, official keyboard shortcuts | Reference for keyboard navigation and density |
| Dropbox | Side preview that keeps the list visible | Spatial continuity |
| Notion / Raycast / Linear | ⌘K palette: recent items when empty, instant results, contextual actions with their shortcut | Do everything from the keyboard, learn the shortcuts along the way |
| Proton Drive | Deep purple sidebar, light content, 44 px rows, neutral selection, inverted toasts at the bottom center, transfer queue at the bottom right | Calm, premium visual language |
| Google / Proton | Deletion → "Undo" toast, no modal | Reversibility |

## Visual language

- `nav` sidebar (deep purple in light mode, near black in dark mode), `canvas` content. A single accent (`accent`, #6d4aff).
- Inter 14/20. Headings in weight 600, never any all-caps text.
- Radii: 8 px (controls, rows), 12 px (panels, dialogs, toasts). Shadows only on what floats (menus, dialogs, upload queue).
- No gradients, no frosted glass, no decorative cards.
- A dark mode designed as such ("Carbon" palette), never `invert()`.

## File behavior

- Click: selects. Double-click or Enter: folder → open, file → preview.
- Cmd/Ctrl+click: toggle, Shift+click: range, Cmd/Ctrl+A: all.
- Right click on an item that is not selected: it becomes the selection, then the menu opens and acts on the selection. Every row also has a `⋮` button.
- The toolbar turns into a selection bar (counter + actions) as soon as there is a selection.
- Dragging items onto a folder (in the list, the breadcrumb or "My Drive" in the sidebar) moves them there.
- Dragging from an empty area draws a selection rectangle, in the list as in the grid; ⌘/Ctrl or Shift adds to the existing selection. The list scrolls by itself near the edges.
- Sorting: folders always first, then the chosen column. The preference is remembered.
- List columns: Name, Access, Modified, Size (+ Last external view when wide).

## Cursors

- Pointer on everything that acts on click: files, buttons, links, menu items, tabs, options.
- "Not allowed" on anything disabled.
- "Grabbing" while pressing a draggable item.
- Thin purple crosshair (custom cursor) while drawing a selection rectangle; system cursor in forced colors mode.

## Shortcuts

| Key | Action |
|---|---|
| ⌘/Ctrl K | Command palette |
| / | Search |
| ↑ ↓ (← → in the grid) | Move the focus; Shift to extend the selection |
| Home / End | First / last item |
| Enter | Open |
| Space | Quick preview (toggle) |
| Esc | Close the panel / the preview / clear the selection |
| ⌘/Ctrl A | Select all |
| Delete / ⌫ | Trash |
| F2 | Rename |
| S | Favorite (owner and readers, each their own) |
| L | Tags of the selection |
| ⌘/Ctrl / | Shortcuts help |
| ← → (full screen preview) | Previous / next file |

## Preview

- Quick preview: a panel on the right (~45% of the content), the list stays visible and navigable; ↑↓ changes the previewed item.
- Full screen preview: `?preview=<id>&full=1`, ← → navigation within the folder. Esc or the browser's "back" returns to the list, intact.
- Images, PDF (pdf.js), text, Markdown, audio, video, HTML (isolated origin, sandboxed iframe). Otherwise: an icon, "This file can't be previewed", Download.
- ZIP site: opens like a web page (same banner, full screen, new tab), relative links and subfolders included; downloading returns the original archive.
- Word, Excel and PowerPoint: a page converted on the server, displayed like HTML. A workbook shows its sheets one below the other, with tabs to jump between them; a presentation shows the text of each slide, with a note that the full layout requires downloading the file.
- Tags: colored pills after the name, shrunk to dots when the column runs out of room; a "Tags" section in the sidebar, each tag leading to its search; a checkbox dialog for a selection (dash checkbox when only part of the selection has the tag), with creation on the fly.
- Drag and drop from the computer, files or whole folders: anywhere in the application. In a folder, they are uploaded there (or into the subfolder under the pointer); elsewhere, and on "My Drive" in the sidebar, they go to the root. A dropped file never makes the browser leave the application, even for a reader (the drop is simply refused).
- In the grid, a folder shows a mosaic of its latest images and videos (one to four, those stored directly inside first, then those in subfolders), with a folder badge so it is not mistaken for a photo. Without any image, it keeps its icon.
- PDF thumbnails show the top of the first page, not its often empty middle. Videos get a thumbnail taken at one second, since the first frame is often black.

## Version history

- "Keep earlier versions" is a checked entry wherever a folder has actions: its right-click menu, the menu of the open folder's name in the breadcrumbs, and the right-click on the empty area inside it. The folder's details hold the same setting as a switch, whose caption says where the choice comes from ("On for everything in Clients") or what replacing does when it is off.
- An open folder that keeps versions shows a "Versions kept" pill next to its name, which opens its details.
- Turning it off asks first, in red, and says what it means: files replaced from then on are overwritten, while versions already kept stay. Turning it on needs no confirmation.
- A file's "Versions" tab (details panel, also "Version history" in the menu): the current version first, earlier ones grouped by day with time and size, a pin on named ones. A click previews a version in a dialog with Download and Restore; the menu adds Name, Remove the name and Delete. The footnote gives the space taken and the cleanup rule in plain words.
- When version history is off, the tab says so and offers to turn it on for the file's folder in one click.
- "Upload new version" (menu and tab) keeps the file's name, whatever the picked file is called.
- The upload conflict dialog knows about history: in a versioned folder, "Replace" is preselected and says the current file stays in its history; elsewhere "Keep both" stays the default.
- Restoring asks for confirmation and says nothing is lost; deleting a version asks too, as it cannot be undone.

## Sharing

- A single panel: people (a role picker, Can view / Can edit / Can manage, only next to members of the organization: everyone else is a reader), inherited access shown with where it comes from, public link (off / anyone with the link), download allowed, expiry, Copy link.
- Adding someone = an email address. Without an account: an "account" invitation by default; "personal link" as an option, with the honest note that it can be forwarded.
- Public and personal links never present the visitor as identified ("Public link", "Paul (personal link)").

## Organizations

- One interface for everyone, filtered by what each person may do on each item (`canEdit`, `canManage`): an action someone cannot perform is absent, not disabled. The server checks again anyway.
- Members see Home, My Drive, Recent, Favorites and Trash. Their My Drive lists their own folder and the folders shared with them; "New" only shows inside a folder. People, Shared and the whole activity log stay with owners.
- The details panel shows the Access and Activity tabs to those who manage the item, Versions to those who can edit it.
- People: a role badge (Member, Owner) and "Make reader / member / owner" in each person's menu; creating an account asks for the role and says how many seats are used. Settings shows the license (organization, seats, expiry) and how to set a key.

## Feedback

- Short action → toast (bottom center, 4 s; 6 s with "Undo"). Error → a toast that stays longer, with a human message and an action when possible. Never "Error 500".
- A modal confirmation only for what cannot be undone: delete permanently, empty the trash, disable or delete a person.
- Loading: skeletons and optimistic updates, never a central spinner. Navigation never disappears.

## Mobile

- < 768 px: sidebar in a drawer, compact header with search, floating "+" button to upload.
- Single-column list (name + metadata on two lines), `⋮` menu as an action sheet. The preview is full screen.
- Public share pages: designed for the phone first (document visible without scrolling, Download button within thumb reach).

## Empty states

Every empty view explains what to do in one sentence, with the main action (Upload, New folder, remove filters…).
