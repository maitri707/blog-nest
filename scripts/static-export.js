const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const ejs = require('ejs');

const DIST = path.join(__dirname, '..', 'dist');
const VIEWS = path.join(__dirname, '..', 'views');
const PUBLIC = path.join(__dirname, '..', 'public');

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function cleanDist() {
  if (fs.existsSync(DIST)) {
    await fsp.rm(DIST, { recursive: true, force: true });
  }
  await ensureDir(DIST);
}

async function copyPublic() {
  if (!fs.existsSync(PUBLIC)) return;
  // copy contents of public/ into dist/ (not dist/public)
  const items = await fsp.readdir(PUBLIC);
  for (const item of items) {
    const src = path.join(PUBLIC, item);
    const dest = path.join(DIST, item);
    // use fs.cp if available
    if (fs.cp) {
      await fs.promises.cp(src, dest, { recursive: true });
    } else {
      // fallback: copy file or directory
      const stat = await fsp.stat(src);
      if (stat.isDirectory()) {
        await copyDirRecursive(src, dest);
      } else {
        await fsp.copyFile(src, dest);
      }
    }
  }
}

async function copyDirRecursive(src, dest) {
  await ensureDir(dest);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

async function loadPosts() {
  // If MONGODB_URI is provided, try to use mongoose to fetch posts.
  if (process.env.MONGODB_URI) {
    try {
      const mongoose = require('mongoose');
      mongoose.set('strictQuery', false);
      await mongoose.connect(process.env.MONGODB_URI);
      // require the Post model from the project so schema matches
      const Post = require(path.join(__dirname, '..', 'server', 'models', 'post.models'));
      const posts = await Post.find().lean();
      // ensure createdAt is a Date for templates
      posts.forEach(p => { p.createdAt = new Date(p.createdAt); });
      await mongoose.disconnect();
      return posts;
    } catch (err) {
      console.warn('Warning: failed to fetch posts from MongoDB, falling back to sample data.', err.message);
    }
  }

  // fallback sample data
  const now = new Date();
  return [
    { _id: '1', title: 'Welcome to BlogNest', body: '<p>This is a sample post created for static export.</p>', createdAt: now },
    { _id: '2', title: 'Second Post', body: '<p>Another example post.</p>', createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24) }
  ];
}

async function renderToFile(templatePath, data, outPath) {
  const opts = { async: true, root: VIEWS };
  // render the body first
  const bodyHtml = await ejs.renderFile(templatePath, data, opts);
  // render layout with body injected
  const layoutPath = path.join(VIEWS, 'layouts', 'main.ejs');
  const layoutHtml = await ejs.renderFile(layoutPath, { ...data, body: bodyHtml }, opts);
  await ensureDir(path.dirname(outPath));
  await fsp.writeFile(outPath, layoutHtml, 'utf8');
}

async function build() {
  console.log('Starting static export...');
  await cleanDist();
  await copyPublic();

  const posts = await loadPosts();

  // render index
  const locals = { title: 'BlogNest', description: 'Simple blog created with NodeJs, Express & MongoDB.' };
  await renderToFile(path.join(VIEWS, 'index.ejs'), { locals, data: posts }, path.join(DIST, 'index.html'));

  // render each post into /post/<id>/index.html so links like /post/ID work on Netlify
  for (const post of posts) {
    const postLocals = { title: post.title, description: locals.description };
    const outDir = path.join(DIST, 'post', String(post._id));
    const outFile = path.join(outDir, 'index.html');
    await renderToFile(path.join(VIEWS, 'post.ejs'), { locals: postLocals, data: post }, outFile);
  }

  console.log('Static export complete. Files written to', DIST);
}

build().catch(err => {
  console.error('Static export failed:', err);
  process.exit(1);
});
