import dayjs from "dayjs";
import { graphql, LIMITS } from "..";
import { GenreCategoryInterface, ShowInterface } from "../../../types/shared";
import {
  extractCollection,
  extractCollectionItem,
  sort,
  uniq,
} from "../../../util";

export async function getRadioPage(preview: boolean) {
  const today = dayjs();

  const { shows, genreCategories } = await getAllShows(preview);

  /**
   * Upcoming & Featured
   */
  const upcomingShows = shows
    .sort(sort.date_ASC)
    .filter((show) => dayjs(show.date).isAfter(today))
    .splice(0, 16);

  /**
   * All Past Shows
   */
  const pastShows = shows
    .sort(sort.date_DESC)
    .filter((show) => dayjs(show.date).isBefore(today));

  const featuredShows = shows.filter((show) => show.isFeatured);

  return {
    upcomingShows,
    pastShows,
    genres: genreCategories,
    featuredShows,
  };
}

export async function getRadioPageSingle(slug: string, preview: boolean) {
  const today = dayjs();

  const RadioPageSingleQuery = /* GraphQL */ `
    query RadioPageSingleQuery($slug: String, $preview: Boolean) {
      showCollection(where: { slug: $slug }, limit: 1, preview: $preview) {
        items {
          title
          date
          slug
          mixcloudLink
          isFeatured
          coverImage {
            sys {
              id
            }
            title
            description
            url
            width
            height
          }
          artistsCollection(limit: 9) {
            items {
              name
              slug
              city {
                name
              }
            }
          }
          genresCollection(limit: 9) {
            items {
              name
            }
          }
          content {
            json
            links {
              assets {
                block {
                  sys {
                    id
                  }
                  contentType
                  title
                  description
                  url
                  width
                  height
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await graphql(RadioPageSingleQuery, {
    variables: { slug, preview },
    preview,
  });

  const entry = extractCollectionItem<ShowInterface>(data, "showCollection");

  if (!entry) {
    throw new Error(`No Show found for slug '${slug}'`);
  }

  const entryGenres = entry.genresCollection.items.map((genre) => genre.name);

  const { shows: allShows } = await getAllShows(preview);

  const relatedShows = allShows.filter((filterShow) => {
    const currentShowGenres = filterShow.genresCollection.items.map(
      (genre) => genre.name
    );

    const isRelatedShowFilter =
      currentShowGenres.filter((genre) => entryGenres.includes(genre)).length >
      0;

    const isNotOwnShow = filterShow.slug !== slug;

    const isPastFilter = dayjs(filterShow.date).isBefore(today);

    return isNotOwnShow && isRelatedShowFilter && isPastFilter;
  });

  return {
    show: entry,
    relatedShows,
  };
}

export async function getAllShows(preview: boolean, limit = LIMITS.SHOWS) {
  const AllShowsQuery = /* GraphQL */ `
    query AllShowsQuery($preview: Boolean, $limit: Int) {
      showCollection(
        order: date_DESC
        where: { artistsCollection_exists: true }
        preview: $preview
        limit: $limit
      ) {
        items {
          title
          date
          slug
          mixcloudLink
          isFeatured
          coverImage {
            sys {
              id
            }
            title
            description
            url
            width
            height
          }
          artistsCollection(limit: 4) {
            items {
              name
              slug
              city {
                name
              }
            }
          }
          genresCollection(limit: 5) {
            items {
              name
              genreCategory {
                name
              }
            }
          }
          content {
            json
          }
        }
      }
    }
  `;

  const shows = await graphql(AllShowsQuery, {
    variables: { preview, limit },
    preview,
  });

  const GenreCategoriesQuery = /* GraphQL */ `
    query AllGenreCategoriesQuery {
      genreCategoryCollection {
        items {
          name
        }
      }
    }
  `;

  const genreCategories = await graphql(GenreCategoriesQuery, {
    preview,
  });

  return {
    shows: extractCollection<ShowInterface>(shows, "showCollection"),
    genreCategories: extractCollection<GenreCategoryInterface>(
      genreCategories,
      "genreCategoryCollection"
    ),
  };
}

export async function getShowsByGenreCategory(
  preview: boolean,
  genre: string,
  skip = 0
) {
  const showsByGenreCategoryQuery = /* GraphQL */ `
    query ShowsByGenreCategoryQuery(
      $preview: Boolean
      $genre: String
      $skip: Int
    ) {
      genreCategoryCollection(
        preview: $preview
        limit: 1
        where: { name: $genre }
      ) {
        items {
          name
          linkedFrom {
            genresCollection(limit: 100) {
              items {
                name
                linkedFrom {
                  showCollection(limit: 8, skip: $skip) {
                    items {
                      title
                      date
                      slug
                      mixcloudLink
                      isFeatured
                      coverImage {
                        sys {
                          id
                        }
                        title
                        url
                        width
                        height
                      }
                      artistsCollection(limit: 4) {
                        items {
                          name
                        }
                      }
                      genresCollection(limit: 4) {
                        items {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const shows = await graphql(showsByGenreCategoryQuery, {
    variables: { preview, genre, skip },
    preview,
  });

  return shows;
}
