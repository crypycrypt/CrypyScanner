# Push this project to GitHub

This file contains commands and a short checklist to push the current project to a new GitHub repository. I can't push for you (no access token), but these commands will do it locally.

1. Create a new repository on GitHub (private or public) and copy the repository URL (HTTPS). Example:
   https://github.com/<your-username>/whaleradar-ai.git

2. From the project root run:

```bash
# initialize git if needed
git init
git add .
git commit -m "Initial WhaleRadar AI commit - feature scaffold and UI"

# add remote and push
git remote add origin https://github.com/<your-username>/whaleradar-ai.git
git branch -M main
git push -u origin main
```

3. If you want to create a .gitignore, typical files to ignore:

```
node_modules/
.next/
.env
.DS_Store
```

4. After pushing, enable GitHub Pages or Vercel/Netlify for hosting. For Next.js, Vercel is recommended (automatic deploys from GitHub).

---
If you'd like, I can create a minimal `.github/workflows/ci.yml` that runs TypeScript checks and installs the project on each push. Ask and I'll add it.
