/* Runs only after the editor clicks the extension; no background crawling. */
(() => {
  window.__nicResearchExtract = () => {
    const meta = (...names) => names.flatMap(name => [...document.querySelectorAll('meta')].filter(el => (el.getAttribute('name') || el.getAttribute('property') || '').toLowerCase() === name.toLowerCase()).map(el => el.getAttribute('content')?.trim()).filter(Boolean));
    const objects = [];
    const visit = value => { if (Array.isArray(value)) return value.forEach(visit); if (value && typeof value === 'object') { objects.push(value); if (value['@graph']) visit(value['@graph']); } };
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) { try { visit(JSON.parse(script.textContent)); } catch { /* Ignore malformed publisher JSON. */ } }
    const article = objects.find(value => [value['@type']].flat().some(type => ['ScholarlyArticle', 'MedicalScholarlyArticle', 'Article'].includes(type))) || {};
    const title = meta('citation_title', 'dc.title', 'prism.title')[0] || article.headline || article.name || document.querySelector('h1')?.innerText || '';
    let authors = meta('citation_author', 'dc.creator');
    if (!authors.length) authors = [article.author || []].flat().map(author => typeof author === 'string' ? author : author.name || [author.givenName, author.familyName].filter(Boolean).join(' ')).filter(Boolean);
    authors = [...new Set(authors)];
    const rawDate = meta('citation_publication_date', 'citation_online_date', 'prism.publicationdate', 'dc.date', 'article:published_time')[0] || article.datePublished || '';
    let publishedDate = '';
    const date = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[T\s])/.exec(String(rawDate));
    if (date) { const day = `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`; const parsed = new Date(day + 'T00:00:00Z'); if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === day) publishedDate = day; }
    let doi = meta('citation_doi', 'prism.doi', 'dc.identifier')[0] || '';
    if (!doi) { const identifiers = [article.identifier || []].flat(); const value = identifiers.find(id => typeof id === 'string' ? /10\.\d{4,9}\//.test(id) : /doi/i.test(id.propertyID || '')); doi = typeof value === 'string' ? value : value?.value || ''; }
    if (!doi) doi = [...document.querySelectorAll('a[href]')].find(el => /^https?:\/\/(?:dx\.)?doi\.org\//i.test(el.href))?.href || '';
    if (!doi) doi = /\/article\/(10\.\d{4,9}\/[^?#]+)/.exec(location.href)?.[1] || '';
    doi = doi.replace(/^doi:\s*/i, '');
    const doiLink = /^10\.\d{4,9}\/\S+$/.test(doi) ? 'https://doi.org/' + doi : /^https?:\/\/(?:dx\.)?doi\.org\//i.test(doi) ? doi : '';
    const journal = meta('citation_journal_title', 'prism.publicationname')[0] || article.isPartOf?.name || '';
    const abstract = document.querySelector('#Abs1-content, #Abs1, .html-abstract, .abstract-content, section.abstract, .abstract, #abstract, [itemprop="abstract"], .article-section__abstract');
    let body = '';
    if (abstract) {
      const copy = abstract.cloneNode(true);
      for (const el of copy.querySelectorAll('script, style, nav, button, .c-article-section__content--restricted')) el.remove();
      for (const el of copy.querySelectorAll('h2, h3, h4')) if (/^abstract\s*$/i.test(el.textContent.trim())) el.remove();
      const text = node => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
        if (node.nodeName === 'BR') return '\n';
        const value = [...node.childNodes].map(text).join('');
        return /^(P|DIV|SECTION|H[1-6]|LI)$/.test(node.nodeName) ? '\n\n' + value + '\n\n' : value;
      };
      body = text(copy).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    if (!body) body = meta('citation_abstract', 'dc.description')[0] || article.abstract || '';
    if (body && typeof body === 'object') body = typeof body.text === 'string' ? body.text : '';
    const warnings = [];
    if (!body) warnings.push('No abstract was found. Add the body before publishing.');
    if (!publishedDate) warnings.push('No complete publication date was found. Confirm it manually.');
    if (!doiLink) warnings.push('No DOI was found. Add it if available.');
    return { title: String(title).trim(), authors: authors.join('; '), publishedDate, doiLink, journal: String(journal).trim(), body: typeof body === 'string' ? body : '', sourceUrl: location.href, warnings };
  };
})();
