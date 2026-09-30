**English** · [Français](organizations.fr.md)

# Drive for Organizations

On its own, Drive has a single owner. Drive for Organizations lets several people manage files together, while everyone you share with stays a reader who can never change anything.

## Who does what

| Role | Takes a seat | What they can do |
|---|---|---|
| Owner | Yes | Everything: every file, people, seats and settings. There can be several. |
| Member | Yes | Works in a folder of their own and in the folders shared with them, as far as their role on each folder allows. |
| Reader | No | Views what is shared with them. Never edits. |

A member starts with a folder named after them, at the top of the drive. They manage it, and owners see it like everything else. Their "My Drive" lists that folder and every folder shared with them.

When a folder is shared with a member, you choose what they can do:

| Role on a folder | View and download | Upload, rename, move, tag, trash, versions | Share, public link, version history setting, delete for good, activity |
|---|---|---|---|
| Can view | Yes | No | No |
| Can edit | Yes | Yes | No |
| Can manage | Yes | Yes | Yes |

Roles follow the folder down to everything inside it, like any share. Readers, invitations and public links only ever view, whatever happens.

## Setting up a license

1. Write to [contact@corentinrenard.com](mailto:contact@corentinrenard.com) with your organization and the number of seats you need.
2. You receive a license key. On the server, run:

   ```bash
   ~/drive/install.sh license KEY
   ```

3. Open **Settings**: the Drive for Organizations section shows who the license is for, the seats used and the expiry date.

The key is signed by the licensor and checked on your server, without any network call. Nothing about your drive ever leaves it.

## Adding people

In **People**, **Create an account** and pick the role: reader, member or owner. The menu next to each person changes their role, disables or deletes their account. Nobody can change their own role.

Owners and active members take a seat; readers are free. Disabling someone or making them a reader frees their seat.

## When the license expires

Nothing breaks and nobody loses access. For 14 days after expiry, everything works as before. After that, you can no longer add members or owners, nor give someone more than viewing, until the license is renewed. Everyone already there keeps what they had.

## When someone leaves

Deleting their account removes their access at once, on the next request. What they created stays in the drive, including their own folder, which owners can move or share with someone else.
