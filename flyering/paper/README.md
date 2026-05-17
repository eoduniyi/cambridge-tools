# The Traveling Flyerperson — Paper

ACM-style write-up of the project that combines the deployed application, the survival/point-process/bandit framework, and the Bayesian hierarchical model into a single defensible artifact.

## Build

```bash
pdflatex the-traveling-flyerperson.tex
pdflatex the-traveling-flyerperson.tex   # second pass for refs
```

## Files

- `the-traveling-flyerperson.tex` — main manuscript (`acmart` `sigconf,nonacm`)
- `figures/` — screenshots of the deployed app
  - `app-desktop.png` — desktop sidebar + map
  - `app-desktop-2.png` — algorithm panel popped out
  - `app-mobile.png` — mobile bottom sheet + FABs
- `the-traveling-flyerperson.pdf` — compiled output (6 pages)

## Source material

- `../Flyer Placement Model Development.md` — full mathematical framework
- `../statistical_flyering_estimation.md` — Q_L estimation summary
- `../statistical_flyering_estimation.html` — interactive companion
