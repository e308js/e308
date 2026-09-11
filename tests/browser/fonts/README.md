# Gallery screenshot font

These unmodified Noto Sans regular/bold fonts are test fixtures, not package or site assets.
They come from Debian's `fonts-noto-core` package (20201225-2); `copyright` contains the
upstream copyright notices and SIL Open Font License 1.1. The upstream project is
https://github.com/notofonts/noto-fonts.

The gallery tests load both weights explicitly and fail if either font fails to load.
This keeps golden-image typography independent of the host's `system-ui` font mapping.
The public starter theme still uses the user's system font.
