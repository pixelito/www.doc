import fs from 'fs';
import { Resvg } from '@resvg/resvg-js';
import * as cheerio from 'cheerio';
import TextToSVG from 'text-to-svg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgInPath = process.argv[2];
const svgOutPath = process.argv[3];
const pngOutPath = process.argv[4];

const fontPath = path.join(__dirname, 'fonts', 'Lexend-Bold.ttf');
const textToSVG = TextToSVG.loadSync(fontPath);

let svgContent = fs.readFileSync(svgInPath, 'utf8');
const $ = cheerio.load(svgContent, { xmlMode: true });

$('text').each((i, el) => {
    const $el = $(el);
    const text = $el.text();
    const x = parseFloat($el.attr('x') || 0);
    const y = parseFloat($el.attr('y') || 0);
    const fontSize = parseFloat($el.attr('font-size') || 12);
    const anchor = $el.attr('text-anchor') || 'start';
    
    const options = { 
        x: 0, 
        y: 0, 
        fontSize: fontSize, 
        anchor: 'left top', 
        attributes: { fill: $el.attr('fill') || '#5C625C' } 
    };
    
    const metrics = textToSVG.getMetrics(text, options);
    const pathData = textToSVG.getD(text, options);
    
    let adjX = x;
    if (anchor === 'middle') adjX -= metrics.width / 2;
    else if (anchor === 'end') adjX -= metrics.width;
    
    const adjY = y - metrics.height * 0.75;
    
    const $path = $('<path></path>');
    $path.attr('d', pathData);
    $path.attr('fill', $el.attr('fill') || '#5C625C');
    $path.attr('transform', `translate(${adjX}, ${adjY})`);
    
    $el.replaceWith($path);
});

$('style, defs').remove();
$('[filter]').removeAttr('filter');

svgContent = $.xml();
fs.writeFileSync(svgOutPath, svgContent);

const opts = {
    fitTo: { mode: 'original' },
    font: {
        fontFiles: [fontPath],
        loadSystemFonts: false,
        defaultFontFamily: 'Lexend'
    }
};

const resvg = new Resvg(svgContent, opts);
const pngData = resvg.render();
const pngBuffer = pngData.asPng();
fs.writeFileSync(pngOutPath, pngBuffer);
