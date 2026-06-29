import * as cheerio from 'cheerio';

export interface ParsedBookmark {
  url: string;
  title: string;
  addDate?: number;
  icon?: string;
  folders: string[];
}

export function parseNetscapeBookmarks(html: string): ParsedBookmark[] {
  const $ = cheerio.load(html);
  const bookmarks: ParsedBookmark[] = [];

  function traverse(element: any, currentFolders: string[]) {
    const node = $(element);
    
    // If it's a link
    if (element.tagName === 'a') {
      const url = node.attr('href');
      const title = node.text();
      const addDate = node.attr('add_date') ? parseInt(node.attr('add_date')!, 10) : undefined;
      const icon = node.attr('icon');
      
      if (url && url.startsWith('http')) {
        bookmarks.push({
          url,
          title,
          addDate,
          icon,
          folders: [...currentFolders],
        });
      }
    }
    
    // If it's a folder title
    if (element.tagName === 'h3') {
      currentFolders.push(node.text());
    }
    
    // If it's a DL container (next level of children)
    if (element.tagName === 'dl') {
      // The H3 before this DL is the folder name, but it's not strictly a parent in DOM, 
      // they are usually siblings inside a DT.
      // Netscape format: <DT><H3>Folder</H3><DL><p> ... </DL><p>
      // The recursive approach requires us to look at children.
    }

    // Since Cheerio doesn't maintain states naturally for sibling trees in Netscape format easily,
    // let's do a different approach: select all 'a' tags and traverse up to find 'h3' siblings of parent 'dl's.
  }

  // Simpler approach: find all 'a' tags, then find their parent folders by looking at closest 'dl' and its previous 'h3' sibling.
  $('a').each((_, el) => {
    const $el = $(el);
    const url = $el.attr('href');
    const title = $el.text();
    const addDate = $el.attr('add_date') ? parseInt($el.attr('add_date')!, 10) : undefined;
    const icon = $el.attr('icon');

    if (!url || !url.startsWith('http')) return;

    // find folders
    const folders: string[] = [];
    let currentDl = $el.closest('dl');
    while (currentDl.length > 0) {
      // The folder name is usually in an H3 tag that is a sibling of the DL, inside the parent DT
      const parentDt = currentDl.closest('dt');
      if (parentDt.length > 0) {
        const h3 = parentDt.children('h3').first();
        if (h3.length > 0) {
          folders.unshift(h3.text());
        }
      } else {
        // sometimes H3 is just a direct previous sibling of DL
        const prevH3 = currentDl.prev('h3');
        if (prevH3.length > 0) {
          folders.unshift(prevH3.text());
        }
      }
      // move up to the next parent DL
      currentDl = currentDl.parent().closest('dl');
    }

    bookmarks.push({
      url,
      title,
      addDate,
      icon,
      folders,
    });
  });

  return bookmarks;
}
