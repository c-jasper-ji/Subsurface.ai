# Subsurface Model 02

## Product objective

Subsurface recommends artists who are recognisably connected to a user's taste while still creating discovery. The output is not presented as an objective measure of taste: it is an inspectable ranking whose components are shown in the product.

## Data sources

- **Last.fm similarity:** candidate generation and relevance.
- **Last.fm artist data:** listener count, community tags and top tracks.
- **Spotify:** artist images and profile links only.

The UI labels Last.fm listeners as Last.fm listeners. It does not describe this value as Spotify monthly listeners or followers.

## Candidate generation

1. Accept one to three seed artists.
2. Request up to 50 listening-led similar artists for each seed.
3. Merge and deduplicate candidates.
4. Exclude the seed artists and obvious combined/collaboration names.
5. Enrich the strongest 30 candidates with artist metadata.
6. Exclude records with no audience data and artists above the 1.5 million Last.fm-listener discovery ceiling.

## Ranking signals

Each remaining artist receives four values on a 0–1 scale.

### Relevance — 52%

Relevance combines the candidate's maximum seed similarity with its average similarity across every seed list in which it appears:

~~~text
relevance = 0.72 × maximum_match + 0.28 × average_match
~~~

### Discovery fit — 22%

Listener counts are log-normalised between a reliability floor of 10,000 and the 1.5 million ceiling. Lower scale receives a higher discovery value without allowing audience size to replace relevance.

### Cross-seed consensus — 18%

~~~text
consensus = number_of_seed_lists_containing_candidate / number_of_seeds
~~~

Appearing near multiple seeds is positive evidence of coherent taste overlap. The previous model treated that overlap as a mainstream penalty; Model 02 separates consensus from audience scale.

### Metadata confidence — 8%

Confidence records whether listener counts, genre tags and top tracks are available. It prevents incomplete records from receiving an equally confident presentation.

### Overall score

~~~text
score =
  0.52 × relevance
+ 0.22 × discovery_fit
+ 0.18 × cross_seed_consensus
+ 0.08 × metadata_confidence
~~~

The UI converts this value to a 1–99 fit score and exposes every component separately.

## Diversity re-ranking

Candidates are assigned to lightweight, human-readable clusters such as Alt R&B / Soul, Electronic Edge, Indie Pop Signal and Rap Adjacent. A small penalty is applied each time a cluster is already represented in the selected set. This re-ranking avoids a top-20 list that is numerically relevant but sonically repetitive.

## Evaluation plan

Without explicit save/skip feedback, the product can monitor:

- result coverage and metadata completeness;
- median Last.fm listener count;
- unique cluster and genre count;
- cross-seed consensus distribution;
- click-through to artist detail and Spotify.

Once users can save or skip results, offline weight tuning and precision-at-k can replace hand-set weights. Until then, the visible weights and recommendation reasons keep the decision process auditable.

## Known limitations

- Last.fm coverage varies by market and can under-represent non-Western listening.
- Community tags are noisy and sometimes inconsistent.
- The cluster layer is rule-based rather than learned from user outcomes.
- Spotify enrichment can degrade under rate limits without changing the underlying Last.fm ranking.
