# Optimal Placement Theory: Statistical Estimation for Flyering

This document outlines a framework for transforming the "Traveling Flyerperson" problem from a simple routing task into a **predictive estimation problem**. We aim to answer: *What is the expected value of a flyer at location $L$?*

## 1. The Estimation Goal
We define a **Location Quality Score ($Q_L$)** as the expected number of conversions per flyer over its lifetime:
$$Q_L = E[C] = P(S) \times T_L \times V_L \times \lambda_{dem}$$

Where:
- $P(S)$: **Survival Probability** (how long before it's torn down or covered).
- $T_L$: **Traffic Volume** (foot traffic density).
- $V_L$: **Visibility/Salience** (height, lighting, clutter level).
- $\lambda_{dem}$: **Demographic Lambda** (the "fit" between the location and software developers).

## 2. Statistical Computing & Algorithms

### A. Survival Analysis (Estimating $P(S)$)
Using the `EVIDENCE_PHOTOS` data (which includes timestamps), we can model the "decay" of a flyer.
- **Method:** Maximum Likelihood Estimation (MLE) using a Weibull distribution to model the time-to-failure (removal).
- **Data Points:** If we see a flyer at $t_1$ and $t_2$, we have a lower bound on survival. If it's gone at $t_3$, we have an upper bound.

### B. Bayesian Updating
We can treat `LOCATIONS.type` as our **Prior**. 
- *Prior:* Libraries have high survival; Whole Foods has low survival (cleared weekly).
- *Update:* Every time we confirm a flyer is still there, we update our belief using Bayes' Rule.

### C. Graph Signal Processing (GSP)
We can treat the city as a graph where nodes are `LOCATIONS` and edges are distances.
- **Smoothness:** We assume that if a cafe at Central Square is "hot" (high engagement), nearby cafes likely have similar properties.
- **Regularization:** Use the Graph Laplacian to interpolate scores for "candidate" spots (from `BOARD_CANDIDATES`) where we haven't placed flyers yet.

## 3. Exogenous Variables for Model Input
- **Proximity to Transit:** (via `TRANSIT_POINTS`) High correlation with "eyes on board" during wait times.
- **Institutional Proximity:** (Harvard/MIT) High $\lambda_{dem}$ for software groups.
- **Clutter Index:** Total number of flyers on the board. (High clutter = high removal risk).

---

## 4. Deep Research Prompt: Statistical Flyering Optimization

**Objective:** Develop a robust statistical model to predict the optimal placement density and location selection for physical flyers in an urban environment (Cambridge, MA).

**Research Areas:**
1. **Survival Modeling:** Research "non-parametric survival analysis for intermittent observations." How do we estimate the lifespan of a physical object when we only check it sporadically?
2. **Point Process Modeling:** Explore "Spatial Poisson Point Processes." Can we model the "flyer population" as a realization of a point process conditioned on traffic and legal restrictions?
3. **Multi-Armed Bandit (MAB) Approach:** How can we frame flyering as an Exploration vs. Exploitation problem? Should I place a flyer in a "proven" spot (Exploit) or try a new candidate board from OpenStreetMap (Explore)?
4. **Exogenous Correlation:** Investigate the correlation between "Amenity Type" (cafe vs. library vs. laundry) and "Engagement Latency." (e.g., Do people spend more time looking at boards when waiting for laundry vs. grabbing coffee?)

**Deliverable Request:** A Python or R prototype that takes `locations.json` and `transit.json` and outputs a "Heatmap of Expected Conversion" using a Bayesian Hierarchical Model.
