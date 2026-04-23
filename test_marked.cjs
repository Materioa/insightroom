const { Marked } = require('marked'); 
const m1 = new Marked(); 
const m2 = new Marked({ 
    renderer: { 
        text(token) { 
            let t = typeof token === 'string' ? token : token.text; 
            return t.replace(/a/g, 'b'); 
        } 
    } 
}); 
console.log('DEFAULT: ', m1.parse('Hello **bold** `code`')); 
console.log('CUSTOM: ', m2.parse('Hello **bold** `code`'));
