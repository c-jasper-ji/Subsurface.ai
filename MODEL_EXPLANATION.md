# Subsurface Model Explanation

## 1. Product Goal

Subsurface recommends artists that are close to a user's existing taste but not necessarily the most obvious mainstream choices. The user enters seed artists, and the model returns a ranked list of Spotify artists with profile images, follower counts, popularity, genres, top tracks and Spotify links.

## 2. Data Source

The system uses the Spotify Web API. The official artist object provides:

- Artist name and Spotify ID.
- `followers.total`.
- `popularity`, from 0 to 100.
- Genres.
- Artist images.
- Spotify profile URL.
- Top tracks and the artists credited on those tracks.

Spotify's official Web API does not expose artist monthly listeners. For this reason, the model uses `followers.total` and `popularity` as official Spotify scale indicators.

## 3. Course Alignment

The model is designed around the course topics that best match a music recommendation product:

- Data Preprocessing.
- Nearest Neighbors.
- Clustering.
- Model Evaluation.

Linear models are not used as the main approach because the app does not have a labelled target variable such as "user liked this artist". Decision trees are possible as an explanation layer, but the core user task is similarity search. Neural networks and reinforcement learning would be heavier than the available data supports.

## 4. Data Preprocessing

The Spotify features have different formats and scales, so preprocessing is required before comparing artists.

### Missing Values

Some artists may have no genres, no image or low metadata coverage. The app keeps the artist but uses safe defaults:

- Missing genres become an empty list.
- Missing follower counts become 0.
- Missing popularity is treated as neutral.
- Missing images fall back to initials.

### Categorical Variables

Genres are categorical multi-label variables. The model treats genres as a multi-hot feature space. For example:

```text
artist_genres = ["alternative r&b", "electronic", "art pop"]
```

This becomes a set of genre tokens used for overlap and distance calculations.

### Standardization

Follower counts can range from thousands to hundreds of millions. To avoid follower scale dominating all other variables, the model uses log normalization:

```text
normalized_followers = log10(followers + 1) / log10(max_followers + 1)
```

Popularity is already on a 0 to 100 scale.

## 5. K-Nearest Neighbors Logic

The core model is a KNN-style content-based recommender. Instead of training a model with labels, it builds a vector-like profile for each candidate artist and ranks candidates by distance to the seed artists.

### Candidate Sources

The system collects candidates from:

1. Artists credited on seed artists' top tracks.
2. Artists found through Spotify genre searches based on seed genres.

This keeps the system Spotify-native while avoiding deprecated recommendation endpoints.

### Similarity Signals

Each candidate receives four main signals:

```text
genre_score
network_score
novelty_score
popularity_fit
```

- `genre_score`: overlap between candidate genres and seed artist genres.
- `network_score`: how often the candidate appears through seed top-track networks.
- `novelty_score`: rewards lower follower counts after log normalization.
- `popularity_fit`: rewards candidates whose popularity is close to the seed artists' average popularity.

### Recommendation Score

The current score is:

```text
score =
  42 * genre_score
+ 24 * network_score
+ 20 * novelty_score
+ 14 * popularity_fit
```

The output is clipped to a 1 to 99 range for readability in the UI.

## 6. Clustering Layer

The app also assigns each recommendation to a lightweight taste cluster. This is inspired by the course clustering material and helps the user understand the recommendation set at a glance.

Current clusters include:

- Alt R&B / Soul.
- Electronic Edge.
- Indie Pop Signal.
- Rap Adjacent.
- Discovery Cluster.

This clustering layer is used in Taste Lab and Replay 26' to show the user's discovery identity.

## 7. Evaluation Approach

Because the app does not yet collect explicit user feedback, classic supervised accuracy is not available. The first evaluation layer should focus on:

- Metadata coverage: percentage of recommendations with image, genres and top tracks.
- Diversity: number of unique clusters and genres.
- Novelty: median follower count of recommended artists.
- Relevance proxy: genre overlap and top-track network overlap.

If future users can save, skip or like recommendations, the app can add classification-style metrics from the course:

- Precision: how many recommended artists are saved.
- Recall: how many relevant artists the app surfaces.
- F1 score: balance between precision and recall.

## 8. Business Interpretation

This model is explainable enough for a product demo:

- It shows which Spotify variables are used.
- It avoids a black-box neural model.
- It connects directly to course concepts.
- It produces user-facing pages: Discover, Artist Profiles, History, Taste Lab and Replay.

The model is therefore suitable for an MBA Big Data, AI and Machine Learning project because it links practical product design with preprocessing, distance-based recommendation and clustering.
