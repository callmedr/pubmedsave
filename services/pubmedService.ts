import type { Article } from '../types';

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';

export type SortOption = 'relevance' | 'pubdate';

export const searchPubMed = async (term: string, sortBy: SortOption): Promise<Article[]> => {
  if (!term.trim()) {
    return [];
  }

  // Step 1: Search for article IDs, sorted by user's choice, limit to 300
  const searchUrl = `${BASE_URL}esearch.fcgi?db=pubmed&term=${encodeURIComponent(
    term
  )}&retmax=300&retmode=json&sort=${sortBy}`;
  
  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    throw new Error('Network response was not ok while searching for articles.');
  }
  const searchData = await searchResponse.json();
  const idList = searchData.esearchresult?.idlist;

  if (!idList || idList.length === 0) {
    return []; // No results found
  }

  // Step 2: Search for IDs of free articles to correctly label them.
  // This uses PubMed's powerful filter to identify all free articles, not just those in PMC.
  const freeTerm = `${term} AND "free full text"[Filter]`;
  const freeSearchUrl = `${BASE_URL}esearch.fcgi?db=pubmed&term=${encodeURIComponent(
    freeTerm
  )}&retmax=300&retmode=json&sort=${sortBy}`;
  
  let freeIdSet = new Set<string>();
  try {
    const freeSearchResponse = await fetch(freeSearchUrl);
    if (freeSearchResponse.ok) {
      const freeSearchData = await freeSearchResponse.json();
      const freeIdList = freeSearchData.esearchresult?.idlist;
      if (freeIdList) {
        freeIdSet = new Set(freeIdList);
      }
    } else {
      console.warn('Could not fetch free article list. "Free Full Text" badges may be inaccurate.');
    }
  } catch (error) {
     console.warn('Error fetching free article list:', error);
  }


  // Step 3: Fetch detailed information for the found IDs
  const ids = idList.join(',');
  const fetchUrl = `${BASE_URL}efetch.fcgi?db=pubmed&id=${ids}&rettype=abstract&retmode=xml`;
  
  const fetchResponse = await fetch(fetchUrl);
  if (!fetchResponse.ok) {
    throw new Error('Network response was not ok while fetching article details.');
  }
  const xmlText = await fetchResponse.text();

  // Step 4: Parse the XML response
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const articles: Article[] = [];
  const articleElements = xmlDoc.getElementsByTagName('PubmedArticle');

  for (const articleEl of Array.from(articleElements)) {
    const pmidEl = articleEl.querySelector('PMID');
    const id = pmidEl?.textContent ?? Date.now().toString(); // Fallback ID

    const titleEl = articleEl.querySelector('ArticleTitle');
    const title = titleEl?.textContent ?? 'No title available';

    const abstractEls = articleEl.querySelectorAll('AbstractText');
    const abstract =
      abstractEls.length > 0
        ? Array.from(abstractEls)
            .map(el => el.textContent)
            .join('\n\n')
        : 'No abstract available.';

    const authorEls = articleEl.querySelectorAll('Author');
    const authorList = Array.from(authorEls)
      .map(author => {
        const lastName = author.querySelector('LastName')?.textContent ?? '';
        const initials = author.querySelector('Initials')?.textContent ?? '';
        return `${lastName} ${initials}`.trim();
      })
      .filter(name => name);
      
    let authors = 'No authors listed';
    if (authorList.length > 0) {
      if (authorList.length > 1) {
        authors = `${authorList[0]} et al.`;
      } else {
        authors = authorList[0];
      }
    }

    const year = articleEl.querySelector('PubDate > Year')?.textContent ?? '';
    const month = articleEl.querySelector('PubDate > Month')?.textContent ?? '';
    const day = articleEl.querySelector('PubDate > Day')?.textContent ?? '';
    const pubDate = [month, day, year].filter(Boolean).join(' ');

    const isFree = freeIdSet.has(id);

    articles.push({
      id,
      title,
      abstract,
      authors,
      pubDate: pubDate || 'No date available',
      pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      isFree,
    });
  }

  return articles;
};