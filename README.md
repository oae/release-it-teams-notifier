# Microsoft Teams Notifier plugin for release-it

This [release-it plugin](https://github.com/release-it/release-it/blob/master/docs/plugins/README.md) ...

```
npm install --save-dev release-it-teams-notifier
```

In [release-it](https://github.com/release-it/release-it) config:

```
"plugins": {
  "release-it-teams-notifier": {
    "webHookUrl": "Incoming webhook url",
    "ignoredContributors": ["Jenkins"],
    "imageUrl": "image url"
  }
}
```
