export default defineTask({
  meta: { name: 'versions:prune', description: 'Thin out old file versions: one a day after a day, one a week after a month' },
  async run() {
    return { result: { files: await pruneAllVersions() } }
  },
})
