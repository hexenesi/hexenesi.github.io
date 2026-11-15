# hexenesi.github.io

Personal portfolio website of **Juan P. Cazarez (hexenesi)**, hosted via GitHub Pages.

🔗 **Live Site:** [https://hexenesi.github.io](https://hexenesi.github.io)

## Featured Projects

- **[asciiart](https://github.com/hexenesi/asciiart)**: C++ utility for image-to-ASCII rendering.
- **[mandelbrot_c](https://github.com/hexenesi/mandelbrot_c)**: High-performance C++ Mandelbrot set renderer.
- **[mandelbrot](https://github.com/hexenesi/mandelbrot)**: Python fractal visualizer & palette generator.
- **[ImageThumbnailer](https://github.com/hexenesi/ImageThumbnailer)**: Java CLI tool for image scaling & batch thumbnails.
- **[HexeFlick](https://github.com/hexenesi/HexeFlick)**: Android app integrating Flickr REST APIs.

## Tech Stack

- HTML5 / vanilla CSS3 (editorial design system, hairline rules, no framework)
- Vanilla JS canvas rendering — the hero and every project thumbnail are generated at runtime
- Light / dark / system theming, persisted in `localStorage`
- Google Fonts (Fraunces, Inter, Fira Code)
- Hosted on GitHub Pages

## Structure

- `index.html` — the single-page site (all sections live here)
- `assets/css/styles.css` — design tokens and all styling
- `assets/js/art.js` — Clifford attractor, Mandelbrot, ASCII and diagram renderers
- `assets/js/main.js` — theme toggle, mobile nav, scroll reveal
- `about.html`, `projects.html` — redirects to the matching `#` sections

## Local Development

```bash
bundle install
bundle exec jekyll serve
```

Then open <http://localhost:4000>.
