/**
 * The GitLab skin's reviewed target vocabulary, beside the skin it describes.
 *
 * The words GitLab's own project and profile menus carry — what `style-parity`
 * checks the applied skin's menu against. The navigation *shape* is not here; it
 * comes from the skin's `layout`. Node-only.
 */
export default {
  vocab: {
    project: [
      'Repository',
      'Merge requests',
      'CI/CD',
      'Analytics',
      'Issue boards',
    ],
    profile: [
      'Activity',
      'Groups',
      'Contributed projects',
      'Personal projects',
      'Starred projects',
      'Snippets',
      'Followers',
      'Following',
    ],
  },
};
