import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, 'src', 'posts');

// Function to remove citations
function removeCitations(content) {
  // Remove all [num] citations
  // This regex matches [1], [2], [123], etc.
  return content.replace(/\[\d+\]/g, '');
}

// Function to process all markdown files
async function processAllPosts() {
  try {
    const files = fs.readdirSync(postsDir);
    const markdownFiles = files.filter(file => file.endsWith('.md'));

    if (markdownFiles.length === 0) {
      console.log('No markdown files found in posts directory.');
      return;
    }

    let processedCount = 0;
    let citationsRemoved = 0;

    for (const file of markdownFiles) {
      const filePath = path.join(postsDir, file);
      let content = fs.readFileSync(filePath, 'utf-8');
      
      // Count citations before removal
      const matches = content.match(/\[\d+\]/g);
      const citationCount = matches ? matches.length : 0;

      // Remove citations
      const newContent = removeCitations(content);

      // Only write if content changed
      if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf-8');
        processedCount++;
        citationsRemoved += citationCount;
        console.log(`✓ ${file} - Removed ${citationCount} citations`);
      } else if (citationCount > 0) {
        console.log(`✓ ${file} - No changes needed`);
      }
    }

    console.log(`\n✅ Complete!`);
    console.log(`📊 Summary:`);
    console.log(`   - Files processed: ${processedCount}`);
    console.log(`   - Total citations removed: ${citationsRemoved}`);
  } catch (error) {
    console.error('Error processing posts:', error);
    process.exit(1);
  }
}

// Run the script
processAllPosts();
