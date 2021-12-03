const { Plugin } = require('release-it');
const { EOL } = require('os');
const _ = require('lodash');
const gravatar = require('gravatar');
const remark = require('remark')
const toMarkdown = require('mdast-util-to-markdown')
const { parseSemVer } = require('semver-parser');
const got = require('got');

const mdOptions = {
  bullet: '-',
  emphasis: '_',
}

class TeamsNotifier extends Plugin {
  async afterRelease() {
    if (this.isReleased || this.config.isDryRun) {
      const commitCount = await this.getCommitCount();
      const contributors = await this.getContributors();

      const sections = this.extractSections();
      const teamsMessage = this.getBaseMessage(commitCount, contributors);

      if(contributors.length > 0) {
        teamsMessage.sections.push({
          text: contributors.map(c => `![](${c.avatar})`).join(' ')
        })
      }

      if(sections.length > 0) {
        teamsMessage.sections.push({text: '---'})
      }

      sections.forEach(section => {
        teamsMessage.sections.push({ text: `## ${section.name}` })
        teamsMessage.sections.push({ text: section.changes.replace('\n-', '\r-') })
      })

      const headers = { 'Content-Type': 'application/json' }
      const body = JSON.stringify(teamsMessage)

      if(this.config.isDryRun) {
        this.log.log(JSON.stringify(teamsMessage, null, 2))
        return;
      }

      await got.post(this.options.webHookUrl, {
        headers,
        body,
      })
    }
  }

  async getCommitCount() {
    const { tagName, latestTag } = this.config.getContext();
    let commitCount;
    if(this.config.isDryRun) {
      commitCount = await this.exec(`git rev-list --count ${latestTag}..HEAD`, {options: {write: false}})
    } else {
      commitCount = await this.exec(`git rev-list --count ${latestTag}..${tagName}`)
    }

    return commitCount;
  }

  async getContributors() {
    const { tagName, latestTag } = this.config.getContext();
    const ignoredContributors  = this.options.ignoredContributors || [];
    let contributors = [];
    if(this.config.isDryRun) {
      contributors = (await this.exec(`git show -s --format='{"name": "%cn", "email": "%ce"}' ${latestTag}..HEAD`, {options: {write: false}})).toString().split(EOL);
    } else {
      contributors = (await this.exec(`git show -s --format='{"name": "%cn", "email": "%ce"}' ${latestTag}..${tagName}`)).toString().split(EOL);
    }

    return _.uniqBy((contributors).map(c => {
      try {
        return JSON.parse(c);
      }
      catch(e) {}
    }), 'email').filter(c => !!c).filter(c => !ignoredContributors.includes(c.name)).map(c => ({
      ...c,
      avatar: gravatar.url(c.email, {protocol: 'https', s: 24})
    }));
  }

  getReleaseType() {
    const { tagName, latestTag } = this.config.getContext();

    const tagSemver = parseSemVer(tagName)
    const newTagSemver = parseSemVer(latestTag);

    if(newTagSemver.major !== tagSemver.major) { return 'major' }
    else if(newTagSemver.minor !== tagSemver.minor) { return 'minor' }
    else if(newTagSemver.patch !== tagSemver.patch) { return 'patch' }
  }

  extractSections() {
    const { changelog } = this.config.getContext();
    const tree = remark.parse(changelog)
    const sections = []
  
    /* eslint-disable-next-line no-plusplus */
    for (let i = 0 ; i < tree.children.length - 1 ; i++) {
      const child = tree.children[i]
      const nextChild = tree.children[i + 1]
      if (
        child.type === 'heading' && child.depth === 3 && child.children[0].type === 'text' && // child is a section
        nextChild.type === 'list' && nextChild.children.length > 0 // next child is a list of changes
      ) {
        sections.push({
          name: child.children[0].value,
          changes: toMarkdown({ type: 'root', children: [nextChild] }, mdOptions)
        })
      }
    }
  
    return sections
  }

  getBaseMessage(commitCount, contributors) {
    const { tagName, latestTag, repo, name } = this.config.getContext()
    const repository = `https://${repo.host}/${repo.repository}`

    const facts = []
  
    facts.push({ name: 'Version', value: `${tagName} (${this.getReleaseType()})` })
  
    if (latestTag){
      facts.push({ name: 'Last Release', value: latestTag })
    }
  
    facts.push({ name: 'Commits', value: commitCount })
  
    if (commitCount > 0) {
      facts.push({ name: 'Contributors', value: contributors.map(c => c.name).join(', ') })
    }
  
    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '2C5697', // gitlab orange
      summary: `Released ${tagName} for ${name}`,
      sections: [
        {
          activityTitle: `🚀🚀 A new version for ${name} has been released 🚀🚀`,
          activitySubtitle: repository,
          activityImage: this.options.imageUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Gitlab_meaningful_logo.svg/144px-Gitlab_meaningful_logo.svg.png',
          facts,
          markdown: true
        }
      ],
    }
  }
}

module.exports = TeamsNotifier;
