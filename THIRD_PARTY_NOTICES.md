# Third-party notices

Libreta itself is MIT-licensed (see `LICENSE`). It ships the following third-party
work, each under its own license. Keep these notices with any redistribution.

## Fonts (`fonts/`, `css/00-fonts.css`)

All fonts are distributed under the **SIL Open Font License 1.1** and were fetched
from Google Fonts by `scripts/vendor-fonts.js`. The OFL permits bundling and
redistribution with software as long as the fonts are not sold on their own.

| Family | Copyright |
|---|---|
| Cormorant | Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant) |
| DM Mono | Copyright 2020 The DM Mono Project Authors (github.com/googlefonts/dm-mono) |
| DM Sans | Copyright 2014–2023 The DM Sans Project Authors (github.com/googlefonts/dm-fonts) |
| Inter | Copyright 2016 The Inter Project Authors (github.com/rsms/inter) |
| Lora | Copyright 2011 The Lora Project Authors (github.com/cyrealtype/Lora-Cyrillic) |
| Newsreader | Copyright 2020 The Newsreader Project Authors (github.com/productiontype/Newsreader) |
| Pixelify Sans | Copyright 2021 The Pixelify Sans Project Authors (github.com/eifetx/Pixelify-Sans) |
| VT323 | Copyright 2011 The VT323 Project Authors (github.com/phoikoi/VT323) |

Full license text: https://openfontlicense.org/open-font-license-official-text/

## KaTeX (`vendor/katex/`)

KaTeX 0.16.11 — MIT License. Copyright (c) 2013–2020 Khan Academy and other contributors.
https://github.com/KaTeX/KaTeX/blob/main/LICENSE

The KaTeX fonts under `vendor/katex/fonts/` are also released under the SIL Open
Font License 1.1.

## Desktop shell (`src-tauri/`)

The Rust dependencies (Tauri and its plugins, and their transitive crates) are
licensed under MIT and/or Apache-2.0; `src-tauri/Cargo.lock` lists every crate and
version. The Tauri CLI (`@tauri-apps/cli`, a dev dependency) is MIT/Apache-2.0.
