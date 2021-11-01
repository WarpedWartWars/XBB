/*

    help.js

    help screen translator for Snap!

    written by Dylan Servilla

    Copyright (C) 2019 by Dylan Servilla

    This file is part of Snap!.

    Snap! is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of
    the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

// HelpScreenMorph //////////////////////////////////////////////////////

// HelpScreenMorph inherits from FrameMorph:

HelpScreenMorph.prototype = new FrameMorph();
HelpScreenMorph.prototype.constructor = HelpScreenMorph;
HelpScreenMorph.uber = FrameMorph.prototype;

// HelpScreenMorph layout settings:

HelpScreenMorph.prototype.screenWidth = 572;
HelpScreenMorph.prototype.padding = 15;
HelpScreenMorph.prototype.verticalPadding = 10;
HelpScreenMorph.prototype.font = '"Times New Roman", Times, serif';

// HelpScreenMorph instance creation:

function HelpScreenMorph(loadCallback) {
    this.init(loadCallback);
}

HelpScreenMorph.prototype.init = function (loadCallback) {
    // additional properties:
    this.thumbnail = null;
    this.imagesLoading = 0;
    this.loadCallback = loadCallback;

    // initialize inherited properties:
    HelpScreenMorph.uber.init.call(this);
    this.bounds.setWidth(HelpScreenMorph.prototype.screenWidth - this.padding);
    this.color = DialogBoxMorph.prototype.color;
    this.acceptsDrops = false;
};

HelpScreenMorph.prototype.fixLayout = function () {
    var myself = this, padding = this.padding,
        verticalPadding = this.verticalPadding, nextY = verticalPadding,
        headerLineHeight;

    this.add(this.thumbnail);
    this.thumbnail.fixLayout();
    if (this.header) {
        this.add(this.header);
        this.header.setLeft(this.thumbnail.right() + padding);
        this.header.setWidth(
            this.right() - this.header.left() - padding
        );
        headerLineHeight = this.header instanceof RichTextMorph
            ? this.header.calculateLineHeight(this.header.lines[0])
            : fontHeight(this.header.fontSize);
        this.header.setTop(
            verticalPadding + (this.thumbnail.height() - verticalPadding) / 2
            - headerLineHeight / 2
        );
    }

    this.children.forEach(function (child) {
        if (child instanceof HelpBoxMorph && child !== myself.thumbnail) {
            child.moveBy(new Point(0, nextY));
            child.fixLayout();
            nextY += child.height() + verticalPadding;
        }
    });
    this.bounds.setHeight(nextY - verticalPadding);
};

HelpScreenMorph.prototype.createThumbnail = function () {
    return new HelpBoxMorph('blue', true);
};

HelpScreenMorph.prototype.createBox = function (color) {
    return new HelpBoxMorph(color);
};

HelpScreenMorph.prototype.createColumn = function () {
    var col = new AlignmentMorph('column', this.padding);
    col.alignment = 'left';
    col.padding = this.verticalPadding;
    return col;
};

HelpScreenMorph.prototype.createRow = function () {
    var row = new AlignmentMorph('row', this.padding);
    row.alignment = 'top';
    row.padding = this.padding;
    return row;
};

HelpScreenMorph.prototype.createParagraph = function (
    str, size, font, color, bold, italic
) {
    var text = new TextMorph(
        str, size, 'serif', bold, italic, null, null, font
    );
    text.color = color;
    return text;
};

HelpScreenMorph.prototype.createRichParagraph = function (
    str, size, font, color, bold, italic
) {
    var text = new RichTextMorph(
        str, size, 'serif', bold, italic, null, null, font
    );
    text.color = color;
    return text;
};

HelpScreenMorph.prototype.createScriptDiagram = function (
    script, annotations, menus, bubbles, defaultArrowColor
) {
    return new ScriptDiagramMorph(
        script, annotations, menus, bubbles, defaultArrowColor
    );
};

HelpScreenMorph.prototype.createImage = function (src, width, height) {
    var myself = this;
    this.imagesLoading += 1;
    return new ImageMorph(
        src, width, height,
        function (img) {
            myself.imageLoaded();
        },
        function () {
            myself.loadCallback(new Error('could not load image ' + src));
        }
    );
};

HelpScreenMorph.prototype.imageLoaded = function () {
    this.imagesLoading -= 1;
    if (this.imagesLoading === 0) {
        this.loadCallback(null, this);
    }
};

HelpScreenMorph.prototype.createMenu = function (items, noEmptyOption) {
    var dict = {}, input = new InputSlotMorph(),
        morph, i, item, itemMorph, tempParent;
    items.forEach(function (item) {
        if (item.tag === 'line') {
            dict['~'] = null;
        } else if (item.tag === 'item') {
            if (item.contents === '§_dir') {
                // direction picker takes its color from its input's parent
                tempParent = new Morph();
                tempParent.setColor(
                    SpriteMorph.prototype.blockColor.motion
                );
                tempParent.add(input);
            }
            // treat the item as an option to force translation
            dict[item.contents] = [item.contents];
        }
    });
    morph = input.menuFromDict(dict, noEmptyOption);
    morph.createItems();
    for (i = 0; i < items.length; i++) {
        item = items[i];
        itemMorph = morph.children[noEmptyOption ? i : i + 1];
        if (item.attributes.color) {
            itemMorph.setColor(item.attributes.color);
        }
        if (item.attributes.annotation) {
            itemMorph.annotationID = item.attributes.annotation;
        }
    }
    morph.adjustWidths();
    return morph;
};

// SnapSerializer ///////////////////////////////////////////////////////////

SnapSerializer.prototype.loadHelpScreen = function (xmlString, ide, callback) {
    // public - answer the HelpScreenMorph represented by xmlString
    var myself = this,
        model = this.parse(xmlString),
        helpScreen = new HelpScreenMorph(callback),
        stage = new StageMorph(),
        target = new SpriteMorph(),
        blocks;

    // hold custom blocks in a fake stage
    this.project.stage = stage;
    target.globalBlocks = this.project.stage.globalBlocks;
    // since the real stage holds library blocks, use that as a backup
    this.project.targetStage = ide.stage;

    if (+model.attributes.version > this.version) {
        throw 'Module uses newer version of Serializer';
    }

    SnapTranslator.loadHelp(translationsLoaded);

    function translationsLoaded () {
        blocks = model.childNamed('blocks');
        if (blocks) {
            myself.loadCustomBlocks(target, blocks, true, false, true);
            myself.populateCustomBlocks(target, blocks, true, true);
        }

        model.children.forEach(function (child) {
            var morph;
            if (child.tag === 'blocks' || child.tag === 'libraries') {
                return;
            }
            morph = myself.loadHelpScreenElement(
                child, helpScreen, target, helpScreen.font, 'white'
            );
            if (child.tag === 'thumbnail') {
                helpScreen.thumbnail = morph;
            } else if (
                child.tag === 'header' || child.tag === 'small-header'
            ) {
                helpScreen.header = morph;
            } else if (morph) {
                helpScreen.add(morph);
            }
        });
    
        helpScreen.fixLayout();
    
        if (helpScreen.imagesLoading === 0) {
            callback(null, helpScreen);
        }
    }
};

SnapSerializer.prototype.loadHelpScreenElement = function (
    element, screen, target, textFont, textColor
) {
    var myself = this, morph, customBlock, script, text, textSize, bold, italic,
        smallTextTags = ['small-header', 'small-p', 'small-i'],
        boldTextTags = ['header', 'small-header'],
        italicTextTags = ['i', 'small-i'];

    function normalizeWhitespace(text) {
        return text.trim().replace(/\s+/g, ' ') // collapse whitespace
                    .replace(/\s*\\n\s*/g, '\n'); // replace \n with newline
    }

    switch (element.tag) {
    case 'block-definition':
        customBlock = detect(target.globalBlocks, function (block) {
            return block.blockSpec() === element.attributes.s;
        });
        morph = new PrototypeHatBlockMorph(customBlock, true);
        morph.nextBlock(customBlock.body.expression);
        morph.fixBlockColor(null, true); // force zebra coloring
        break;
    case 'bool':
        return element.contents === 'true';
    case 'box':
        morph = screen.createBox(element.attributes.color);
        textColor = element.attributes.color === 'blue'
                        ? 'black' : 'white';
        break;
    case 'column':
        morph = screen.createColumn();
        break;
    case 'diagram':
        script = myself.loadHelpScreenElement(
            element.childNamed('block-definition')
                || element.childNamed('menu')
                || element.require('script'),
            screen, target, textColor, textColor
        );
        morph = screen.createScriptDiagram(
            script,
            element.childNamed('annotations')
                ? element.require('annotations').children.map(
                    function (child) {
                        var morph = myself.loadHelpScreenElement(
                            child, screen, target, textFont, textColor
                        );
                        myself.handleAnnotations(child, morph);
                        return morph;
                    }
                ) : [],
            element.childNamed('menus')
                ? element.childNamed('menus').children.map(function (child) {
                    return myself.loadHelpScreenElement(
                        child, screen, target, textFont, textColor
                    );
                })
                : [],
            element.childNamed('bubbles')
                ? element.childNamed('bubbles').children.map(function (child) {
                    return myself.loadHelpScreenElement(
                        child, screen, target, textFont, textColor
                    );
                })
                : [],
            textColor
        );
        break;
    case 'img':
        morph = screen.createImage(
            element.attributes.src,
            +element.attributes.width,
            +element.attributes.height
        );
        break;
    case 'menu':
        morph = screen.createMenu(
            element.children,
            element.attributes['no-empty-option']
        );
        break;
    case 'header':
    case 'small-header':
    case 'p':
    case 'small-p':
    case 'i':
    case 'small-i':
        if (element.attributes.color) {
            textColor = element.attributes.color;
        }
        if (element.attributes.font) {
            textFont = element.attributes.font;
        }
        textSize = contains(smallTextTags, element.tag)
                        ? 16 : 20;
        bold = contains(boldTextTags, element.tag);
        italic = contains(italicTextTags, element.tag);
        if (element.children.length === 0) {
            morph = screen.createParagraph(
                element.attributes.id
                    ? SnapTranslator.translateHelp(element.attributes.id)
                    : normalizeWhitespace(element.contents),
                textSize, textFont, textColor, bold, italic
            );
        } else {
            morph = screen.createRichParagraph(
                null, textSize, textFont, textColor, bold, italic
            );
            if (element.attributes.id) { 
                morph.text = this.translateRichHelpText(
                    element, screen, target, textFont, textColor
                );
            } else {
                morph.text = element.children.map(function (child) {
                    return myself.loadHelpScreenElement(
                        child, screen, target, textFont, textColor
                    );
                });
            }
            morph.fixLayout();
        }
        break;
    case 'row':
        morph = screen.createRow();
        break;
    case 'script':
        morph = this.loadScript(element, target, true);
        morph.fixBlockColor(null, true); // force zebra coloring
        break;
    case 'text':
        text = element.attributes.id
            ? SnapTranslator.translateHelp(element.attributes.id)
            : normalizeWhitespace(element.contents);
        return element.attributes.font || element.attributes.color
            ? {
                text: text,
                font: element.attributes.font,
                color: element.attributes.color
            } : text;
    case 'thumbnail':
        morph = screen.createThumbnail();
        break;
    }
    if (morph) {
        if (morph instanceof BlockMorph && element.attributes.scale) {
            morph.scriptScale = +element.attributes.scale;
        }
        if (
            morph instanceof BlockMorph
            && (!element.parent || element.parent.tag !== 'diagram')
        ) {
            // contain BlockMorphs in diagrams so they can be scaled
            morph = screen.createScriptDiagram(morph, [], [], [], textColor);
        }
        if (
            morph instanceof AlignmentMorph
            || morph instanceof HelpBoxMorph
            || morph instanceof ScriptDiagramMorph
            || morph instanceof TextMorph
        ) {
            if (element.attributes['width']) {
                morph.bounds.setWidth(+element.attributes['width']);
                morph.relativeWidth = 0;
            } else if (element.attributes['rel-width']) {
                // width will be adjusted later
                morph.relativeWidth = +element.attributes['rel-width'] || 1;
            } else if (
                morph instanceof ScriptDiagramMorph
                && morph.annotations.length === 0
            ) {
                // consider script diagrams to have a fixed width if there
                // are no annotations, and not manually given a rel-width
                morph.relativeWidth = 0;
            } else {
                // default to 1
                morph.relativeWidth = 1;
            }
        }
        if (morph instanceof AlignmentMorph && element.attributes.padding) {
            morph.padding = +element.attributes.padding;
        }
        if (element.attributes.x) {
            morph.shiftRight = +element.attributes.x;
        }
        if (element.attributes.y) {
            morph.shiftDown = +element.attributes.y;
        }
        if (
            !(morph instanceof RichTextMorph
            || morph instanceof ScriptDiagramMorph)
        ) {
            // add children
            element.children.forEach(function (child) {
                var childMorph = myself.loadHelpScreenElement(
                    child, screen, target, textFont, textColor
                );
                if (childMorph) {
                    morph.add(childMorph);
                }
            });
        }
    }
    return morph;
};

SnapSerializer.prototype.translateRichHelpText = function(
    element, screen, target, textFont, textColor
) {
    // replace {n} in the translated string with the morph
    // represented by the element's nth child or the element
    // with a matching id attribute

    var translation = SnapTranslator.translateHelp(element.attributes.id),
        inPlaceholder = false, part = '', parts = [],
        i, ch, componentIdx, component;

    for (i = 0; i < translation.length; i++) {
        ch = translation[i];
        if (ch === '{') {
            if (inPlaceholder) {
                throw new Error('translateRichHelpText: Unexpected {');
            } else {
                inPlaceholder = true;
                if (part.length > 0) {
                    parts.push(part.trim());
                    part = '';
                }
            }
        } else if (ch === '}') {
            if (!inPlaceholder) {
                throw new Error('translateRichHelpText: Unexpected }');
            } else {
                inPlaceholder = false;
                componentIdx = parseInt(part);
                if (
                    !isNaN(componentIdx)
                    && 1 <= componentIdx
                    && componentIdx <= element.children.length
                ) {
                    component = element.children[componentIdx - 1];
                } else {
                    component = detect(
                        element.children,
                        (child) => child.attributes.id === part
                    );
                }
                if (component) {
                    parts.push(
                        this.loadHelpScreenElement(
                            component,
                            screen,
                            target,
                            element.attributes.font || textFont,
                            element.attributes.color || textColor
                        )
                    );
                } else {
                    parts.push('{' + part + '}');
                }
                part = '';
            }
        } else {
            part += ch;
        }
    }
    if (part.length > 0) {
        parts.push(part.trim());
    }

    return parts;
};

SnapSerializer.prototype.handleAnnotations = function (model, morph) {
    if (model.attributes['annotation']) {
        morph.annotationID = model.attributes['annotation'];
    }
    if (model.attributes['menu']) {
        morph.annotationMenu = model.attributes['menu'];
    }
    if (model.attributes['arrow-start']) {
        morph.annotationArrowStart = model.attributes['arrow-start'];
    }
    if (model.attributes['arrow-end']) {
        morph.annotationArrowEnd = model.attributes['arrow-end'];
    }
    if (model.attributes['arrow-reverse']) {
        morph.annotationArrowReverse = model.attributes['arrow-reverse'];
    }
    if (model.attributes['arrow-detour']) {
        morph.annotationArrowDetour = +model.attributes['arrow-detour'] || 0;
    }
    if (model.attributes['arrow-horizontal']) {
        morph.annotationArrowHorizontal = model.attributes['arrow-horizontal'] === 'true';
    }
    if (model.attributes['arrow-color']) {
        morph.annotationArrowColor = model.attributes['arrow-color'];
    }
    if (model.attributes['bubble']) {
        morph.annotationBubble = model.attributes['bubble'];
    }
    if (model.attributes['highlight']) {
        morph.annotationHighlight = model.attributes['highlight'] === 'true';
    }
    if (model.attributes['ghost']) {
        morph.annotationGhost = model.attributes['ghost'] === 'true';
    }
};

// HelpBoxMorph /////////////////////////////////////////////////////////////

HelpBoxMorph.prototype = new BoxMorph();
HelpBoxMorph.prototype.constructor = HelpBoxMorph;
HelpBoxMorph.uber = BoxMorph.prototype;

function HelpBoxMorph(color, isThumbnail) {
    this.init(color, isThumbnail);
}

HelpBoxMorph.prototype.init = function (color, isThumbnail) {
    // initialize inherited properties:
    HelpBoxMorph.uber.init.call(this);

    this.setColorName(color);
    this.isThumbnail = isThumbnail || false;
};

HelpBoxMorph.prototype.setColorName = function (color) {
    if (color === this.colorName) {
        return;
    }
    this.colorName = color;
    if (color === 'blue') {
        this.color = new Color(214, 225, 235);
        this.borderColor = new Color(153, 156, 158);
    } else if (color === 'black') {
        this.color = new Color(50, 52, 54);
        this.borderColor = new Color(153, 156, 158);
    } else { // gray is default
        this.color = new Color(133, 138, 140);
        this.borderColor = new Color(183, 186, 188);
    }
};

HelpBoxMorph.prototype.fixChildrenExtents = function () {
    var screen = this.parentThatIsA(HelpScreenMorph),
        padding = screen.padding;

    function fixWidth (morph) {
        var parent = morph.parent, maxWidth;

        if (morph.isThumbnail || morph === screen.header) {
            return;
        }

        if (
            morph instanceof AlignmentMorph
            || morph instanceof HelpBoxMorph
            || morph instanceof ScriptDiagramMorph
            || morph instanceof TextMorph
        ) {
            if (
                morph.relativeWidth != null
                && parent instanceof AlignmentMorph
                && parent.orientation === 'row'
            ) {
                if (morph.relativeWidth !== 0) {
                    if (morph instanceof AlignmentMorph) {
                        morph.fixLayout();
                    }
                    maxWidth = morph.relativeWidth
                        / parent.relWidthDenominator
                        * (parent.width() - parent.usedWidth);
                    if (
                        morph instanceof TextMorph
                        && morph.width() <= maxWidth
                    ) {
                        parent.usedWidth += morph.width();
                        parent.relWidthDenominator -= morph.relativeWidth;
                        morph.relativeWidth = 0;
                    } else {
                        morph.bounds.setWidth(maxWidth);
                    }
                }
            } else if (parent instanceof HelpBoxMorph) {
                morph.bounds.setWidth(parent.width() - 2 * padding);
            } else {
                morph.bounds.setWidth(parent.width());
            }
        }
        if (morph instanceof AlignmentMorph && morph.orientation === 'row') {
            // calculate the total known used width of row items
            morph.usedWidth = morph.padding * (morph.children.length - 1)
                + morph.children.reduce(
                    function (width, child) {
                        if (child.relativeWidth) {
                            return width;
                        } else if (child instanceof BlockMorph) {
                            return width
                                + child.stackFullBounds().width();
                        } else {
                            return width + child.width();
                        }
                    }, 0
                );
            morph.relWidthDenominator = morph.children.reduce(
                function (width, child) {
                    return width + (child.relativeWidth || 0);
                }, 0
            );
        }
        if (
            morph instanceof AlignmentMorph
            || morph instanceof HelpBoxMorph
        ) {
            morph.children.forEach(fixWidth);
        }
    }

    function fixHeight (morph) {
        if (morph instanceof AlignmentMorph) {
            if (morph.orientation === 'row') {
                // height of boxes depends on the height of other row items
                morph.children.forEach(function (child) {
                    if (!(child instanceof HelpBoxMorph)) {
                        fixHeight(child);
                    }
                });
                morph.fixLayout();
                morph.children.forEach(function (child) {
                    if (child instanceof HelpBoxMorph) {
                        fixHeight(child);
                    }
                });
                morph.fixLayout();
            } else {
                morph.children.forEach(fixHeight);
                morph.fixLayout();
            }
        } else if (
            morph instanceof HelpBoxMorph
            || morph instanceof ScriptDiagramMorph
        ) {
            morph.fixLayout();
        }
    }

    if (!this.isThumbnail) {
        this.children.forEach(fixWidth);
    }
    this.forAllChildren(function (child) {
        // Reflow rich text
        if (child instanceof TextMorph) {
            child.children.forEach(function (child) {
                if (typeof child.fixLayout === 'function') {
                    child.fixLayout();
                }
            });
            child.setWidth(child.width());
        }
    });
    this.children.forEach(fixHeight);
};

HelpBoxMorph.prototype.fixLayout = function () {
    var screen = this.parentThatIsA(HelpScreenMorph),
        padding = screen.padding, myself = this,
        startX, startY, width = 0, height = 0;

    if (this.parent instanceof HelpScreenMorph && !this.isThumbnail) {
        this.bounds.setWidth(this.parent.width());
    }
    this.fixChildrenExtents();
    startX = this.left();
    startY = this.top();
    this.children.forEach(function (child) {
        child.moveBy(new Point (
            (child.shiftRight || 0) + padding,
            (child.shiftDown || 0) + padding
        ));
        if (myself.parent === screen && !myself.isThumbnail) {
            if (child.right() > myself.right()) {
                child.setWidth(myself.right() - padding - child.left());
            }
            if (child.top() < screen.thumbnail.bottom() + padding) {
                child.setTop(screen.thumbnail.bottom() + padding);
            }
            if (
                screen.header
                && child.top() < screen.header.bottom() + padding
            ) {
                child.setTop(screen.header.bottom() + padding);
            }
        }
        width = Math.max(width, child.right() - startX);
        height = Math.max(height, child.bottom() - startY);
    });
    if (this.isThumbnail) {
        this.bounds.setWidth(width + padding);
    }
    if (
        this.parent instanceof AlignmentMorph
        && this.parent.orientation === 'row'
    ) {
        this.bounds.setHeight(Math.max(height + padding, this.parent.height()));
    } else {
        this.bounds.setHeight(height + padding);
    }
};

// ImageMorph ///////////////////////////////////////////////////////////////

ImageMorph.prototype = new Morph();
ImageMorph.prototype.constructor = ImageMorph;
ImageMorph.uber = Morph.prototype;

function ImageMorph(src, width, height, onload, onerror) {
    this.init(src, width, height, onload, onerror);
}

ImageMorph.prototype.init = function (src, width, height, onload, onerror) {
    var myself = this;

    // initialize inherited properties:
    ImageMorph.uber.init.call(this);

    this.diagram = null;
    this.setExtent(new Point(width, height));
    this.pic = new Image();
    this.pic.onload = function () {
        myself.rerender();
        myself.changed();
        if (myself.diagram) {
            // redraw containing diagram
            myself.diagram.rerender();
        }
        if (typeof onload === 'function') {
            onload();
        }
    };
    this.pic.onerror = function () {
        if (SnapTranslator.language !== 'en') {
            myself.pic.src = IDE_Morph.prototype.resourceURL(
                'help', 'en', src
            );
        } else if (typeof onerror === 'function') {
            onerror();
        }
    };
    this.pic.src = IDE_Morph.prototype.resourceURL(
        'help', SnapTranslator.language, src
    );
};

ImageMorph.prototype.render = function (ctx) {
    if (this.pic) {
        ctx.drawImage(this.pic, 0, 0, this.width(), this.height());
    }
};

// RichTextMorph ////////////////////////////////////////////////////////////

// I am a multi-line, word-wrapping String that can have other morphs inlined

// RichTextMorph inherits from TextMorph:

RichTextMorph.prototype = new TextMorph();
RichTextMorph.prototype.constructor = RichTextMorph;
RichTextMorph.uber = TextMorph.prototype;

// RichTextMorph instance creation:

function RichTextMorph(
    text,
    fontSize,
    fontStyle,
    bold,
    italic,
    alignment,
    width,
    fontName,
    shadowOffset,
    shadowColor
) {
    this.init(text,
        fontSize,
        fontStyle,
        bold,
        italic,
        alignment,
        width,
        fontName,
        shadowOffset,
        shadowColor);
}

RichTextMorph.prototype.init = function (
    text,
    fontSize,
    fontStyle,
    bold,
    italic,
    alignment,
    width,
    fontName,
    shadowOffset,
    shadowColor
) {
    // initialize inherited properties:
    RichTextMorph.uber.init.call(this,
        text || ['RichTextMorph'],
        fontSize,
        fontStyle,
        bold,
        italic,
        alignment,
        width,
        fontName,
        shadowOffset,
        shadowColor);
};

RichTextMorph.prototype.toString = function () {
    // e.g. 'a RichTextMorph("Hello World")'
    return 'a RichTextMorph' + '("' + this.text.join(' ').slice(0, 30) + '...")';
};

RichTextMorph.prototype.parse = function () {
    var myself = this,
        canvas = newCanvas(),
        context = canvas.getContext('2d'),
        line = [],
        lineWidth = 0,
        w,
        prependSpace = false,
        nextWord;

    context.font = this.font();
    this.maxLineWidth = 0;
    this.lines = [];
    this.words = [];

    this.text.forEach(function (item) {
        var paragraphs, i, p;
        if (item instanceof Morph) {
            myself.words.push(item);
            if (item.parent !== this) {
                myself.add(item);
            }
        } else {
            paragraphs = (item.text || item).split('\n');
            for (i = 0; i < paragraphs.length; i++) {
                p = paragraphs[i];
                myself.words = myself.words.concat(
                    p.split(' ').map(function (word) {
                        return item.font || item.color
                            ? {
                                text: word,
                                font: item.font,
                                color: item.color
                            } : word;
                    })
                );
                if (i < paragraphs.length - 1) {
                    myself.words.push('\n');
                }
            }
        }
    });

    this.words.forEach(function (word, i) {
        if (word === '\n') {
            myself.lines.push(line);
            myself.maxLineWidth = Math.max(myself.maxLineWidth, lineWidth);
            line = [];
            lineWidth = 0;
        } else {
            if (prependSpace) {
                if (word.font === myself.words[i-1].font) {
                    context.font = myself.font(word.font);
                } else {
                    context.font = myself.font();
                }
                w = context.measureText(' ').width;
            } else {
                w = 0;
            }
            context.font = myself.font(word.font);
            w += myself.calculateWordWidth(word);
            if (myself.maxWidth > 0 && lineWidth + w > myself.maxWidth) {
                myself.lines.push(line);
                myself.maxLineWidth = Math.max(
                    myself.maxLineWidth,
                    lineWidth
                );
                line = [word];
                lineWidth = w;
            } else {
                if (prependSpace) {
                    if (word instanceof Morph) {
                        line.push(' ');
                        line.push(word);
                    } else if (typeof word === 'string') {
                        line.push(' ' + word);
                    } else if (word.font === myself.words[i-1].font) {
                        word.text = ' ' + word.text;
                        line.push(word);
                    } else {
                        line.push(' ');
                        line.push(word);
                    }
                } else {
                    line.push(word);
                }
                lineWidth += w;
            }
            nextWord = myself.words[i+1];
            if (
                word === '(' || nextWord == null || (
                    typeof nextWord === 'string' && (
                        contains(['.', ',', '!', '\n'], myself.words[i+1])
                        || myself.words[i+1].startsWith(')')
                    )
                )
            ) {
                prependSpace = false;
            } else {
                prependSpace = true;
            }
        }
    });
    this.lines.push(line);
    this.maxLineWidth = Math.max(this.maxLineWidth, lineWidth);
};

RichTextMorph.prototype.font = function (fontName) {
    // answer a font string, e.g. 'bold italic 12px sans-serif'
    fontName = fontName || this.fontName;
    var font = '';
    if (this.isBold) {
        font = font + 'bold ';
    }
    if (this.isItalic) {
        font = font + 'italic ';
    }
    return font +
        this.fontSize + 'px ' +
        (fontName ? fontName + ', ' : '') +
        this.fontStyle;
};

RichTextMorph.prototype.fixLayout = function () {
    var myself = this, height, shadowHeight, shadowWidth;

    this.parse();

    // set my extent
    shadowWidth = Math.abs(this.shadowOffset.x);
    shadowHeight = Math.abs(this.shadowOffset.y);
    height = 0;
    this.lines.forEach(function (line) {
        height += myself.calculateLineHeight(line) + shadowHeight;
    });
    if (this.lines.length > 0) {
        height += this.calculateLineDescent(this.lines[this.lines.length - 1]);
    }
    if (this.maxWidth === 0) {
        this.bounds = this.bounds.origin.extent(
            new Point(this.maxLineWidth + shadowWidth, height)
        );
    } else {
        this.bounds = this.bounds.origin.extent(
            new Point(this.maxWidth + shadowWidth, height)
        );
    }

    // notify my parent of layout change
    if (this.parent) {
        if (this.parent.layoutChanged) {
            this.parent.layoutChanged();
        }
    }
};

RichTextMorph.prototype.render = function (ctx) {
    var width, i, j, line, lineHeight, lineDescent, word,
    shadowHeight, shadowWidth, offx, offy, x, y,
    defaultColor = this.color.toString();

    shadowWidth = Math.abs(this.shadowOffset.x);
    shadowHeight = Math.abs(this.shadowOffset.y);

    // prepare context for drawing text
    ctx.font = this.font();
    ctx.textAlign = 'left';

    // fill the background, if desired
    if (this.backgroundColor) {
        ctx.fillStyle = this.backgroundColor.toString();
        ctx.fillRect(0, 0, this.width(), this.height());
    }

    // don't bother with drawing shadow

    // now draw the actual text
    offx = Math.abs(Math.min(this.shadowOffset.x, 0));
    offy = Math.abs(Math.min(this.shadowOffset.y, 0));

    y = 0;
    for (i = 0; i < this.lines.length; i++) {
        line = this.lines[i];
        width = this.calculateLineWidth(line) + shadowWidth;
        if (this.alignment === 'right') {
            x = this.width() - width;
        } else if (this.alignment === 'center') {
            x = (this.width() - width) / 2;
        } else { // 'left'
            x = 0;
        }
        lineHeight = this.calculateLineHeight(line);
        lineDescent = this.calculateLineDescent(line);
        y += lineHeight / 2;
        for (j = 0; j < line.length; j = j + 1) {
            word = line[j];
            if (word instanceof Morph) {
                word.setPosition(this.position().add(new Point(
                    x + offx, 
                    y - (this.calculateWordHeight(word) / 2) + offy
                        + lineDescent
                )));
            } else {
                ctx.font = this.font(word.font);
                ctx.fillStyle = word.color || defaultColor;
                ctx.fillText(
                    word.text || word, x + offx,
                    y + (this.calculateWordHeight(word) / 2) + offy
                );
            }
            x += this.calculateWordWidth(word);
        }
        y += lineHeight / 2 + shadowHeight;
    }
};

RichTextMorph.prototype.calculateWordWidth = function (word) {
    var canvas = newCanvas(),
        context = canvas.getContext('2d');
    context.font = this.font(word.font);
    if (word instanceof BlockMorph) {
        return word.stackFullBounds().width();
    } else if (word instanceof Morph) {
        return word.width();
    }
    return context.measureText(word.text || word).width;
};

RichTextMorph.prototype.calculateLineWidth = function (line) {
    var myself = this, width = 0;
    line.forEach(function (word) {
        width += myself.calculateWordWidth(word);
    });
    return width;
};

RichTextMorph.prototype.calculateWordHeight = function (word) {
    if (word instanceof BlockMorph) {
        return word.stackFullBounds().height();
    } else if (word instanceof Morph) {
        return word.height();
    }
    return fontHeight(this.fontSize);
};

RichTextMorph.prototype.calculateLineHeight = function (line) {
    var myself = this, height = 0;
    line.forEach(function (word) {
        height = Math.max(height, myself.calculateWordHeight(word));
    });
    return height;
};

RichTextMorph.prototype.calculateFontDescent = function (font) {
    // measure the height of the tail in 'q'
    var canvas = newCanvas(),
        context = canvas.getContext('2d');
    context.font = this.font(font);
    return context.measureText('q').actualBoundingBoxDescent || 0;
};

RichTextMorph.prototype.calculateLineDescent = function (line) {
    var fontDescents = {}, maxDescent;
    fontDescents[this.fontName] = this.calculateFontDescent(this.fontName);
    maxDescent = fontDescents[this.fontName];
    line.forEach((word) => {
        if (word.font && !fontDescents.hasOwnProperty(word.font)) {
            fontDescents[word.font] = this.calculateFontDescent(word.font);
            maxDescent = Math.max(maxDescent, fontDescents[word.font]);
        }
    });
    return maxDescent;
};

// ScriptDiagramMorph ///////////////////////////////////////////////////

// ScriptDiagramMorph inherits from FrameMorph:

ScriptDiagramMorph.prototype = new FrameMorph();
ScriptDiagramMorph.prototype.constructor = ScriptDiagramMorph;
ScriptDiagramMorph.uber = FrameMorph.prototype;

// ScriptDiagramMorph layout settings:

ScriptDiagramMorph.prototype.margin = 30;
ScriptDiagramMorph.prototype.padding = 5;

// ScriptDiagramMorph instance creation:

function ScriptDiagramMorph(
    script,
    annotation,
    menus,
    bubbles,
    defaultArrowColor
) {
    this.init(
        script,
        annotation,
        menus,
        bubbles,
        defaultArrowColor
    );
}

ScriptDiagramMorph.prototype.init = function (
    script,
    annotations,
    menus,
    bubbles,
    defaultArrowColor
) {
    // additional properties:
    this.script = script;
    this.scriptContainer = new Morph();
    this.scriptContainer.alpha = 0;
    this.scriptScale = 1;
    this.annotations = annotations || [];
    this.menus = menus || [];
    this.bubbles = bubbles || [];
    this.defaultArrowColor = defaultArrowColor;
    this.arrows = [];
    this.widthNoBubble = 0;
    this.widthNoAnnotations = 0;
    this.heightNoAnnotations = 0;

    // initialize inherited properties:
    ScriptDiagramMorph.uber.init.call(this);

    this.isDraggable = false;
    this.isTemplate = true;

    this.acceptsDrops = false;
    this.populateDiagram();
};

ScriptDiagramMorph.prototype.reactToTemplateCopy = function () {
    return this.script;
};

ScriptDiagramMorph.prototype.populateDiagram = function () {
    var myself = this, scriptWidth, scriptHeight, displayWidth,
        displayHeight;

    if (this.script instanceof BlockMorph) {
        scriptWidth = this.script.stackFullBounds().width();
        scriptHeight = this.script.stackFullBounds().height();
    } else {
        scriptWidth = this.script.width();
        scriptHeight = this.script.height();
    }
    this.scriptScale = this.script.scriptScale || 1;
    displayWidth = scriptWidth;
    displayHeight = scriptHeight;
    this.widthNoBubble = displayWidth;

    this.script.forAllChildren(function (child) {
        if (child.annotationHighlight) {
            child.addDiagramHighlight();
        }
    });
    this.script.forAllChildren(function (child) {
        if (child.annotationGhost) {
            child.ghost();
        }
    });
    this.scriptContainer.add(this.script);

    this.bubbles.forEach(function (bubbleValue, i) {
        var annotated, bubble;
        annotated = myself.getAnnotatedMorph('annotationBubble', i + 1);
        if (annotated) {
            if (bubbleValue instanceof ImageMorph) {
                // diagram will need to be redrawn on image load
                bubbleValue.diagram = myself;
            }
            bubble = annotated.showBubble(
                bubbleValue, false, new SpriteMorph(), true
            );
            myself.scriptContainer.add(bubble);
            bubble.fullChanged();
            bubble.setTop(2);
            bubble.setLeft(myself.script.right() + 2);
            if (myself.annotations.length === 0) {
                myself.script.setTop(
                    Math.max(
                        myself.script.top(),
                        bubble.bottom() - scriptHeight / 2
                    )
                );
            } else {
                // bubble is higher to make room for annotations
                myself.script.setTop(
                    Math.max(myself.script.top(), bubble.bottom())
                );
            }
            displayWidth = Math.max(
                displayWidth, bubble.fullBounds().right()
            );
            displayHeight = Math.max(
                displayHeight, myself.script.bottom()
            );
        }
    });

    this.menus.forEach(function (menu, i) {
        var annotated;
        annotated = myself.getAnnotatedMorph('annotationMenu', i + 1);
        if (annotated) {
            myself.scriptContainer.add(menu);
            menu.setPosition(annotated.rightCenter().add(new Point(-10, 5)));
            myself.widthNoBubble = Math.max(
                myself.widthNoBubble,
                menu.fullBounds().right() - myself.left()
            );
            displayWidth = Math.max(
                displayWidth,
                menu.fullBounds().right() - myself.left()
            );
            displayHeight = Math.max(
                displayHeight,
                menu.fullBounds().bottom() - myself.top()
            );
        }
    });

    displayWidth = Math.ceil(displayWidth);
    displayHeight = Math.ceil(displayHeight);
    this.scriptContainer.setExtent(new Point(displayWidth, displayHeight));
    displayWidth = Math.ceil(displayWidth * this.scriptScale);
    displayHeight = Math.ceil(displayHeight * this.scriptScale);
    this.widthNoBubble *= this.scriptScale;
    // default extent doesn't include annotations
    this.widthNoAnnotations = displayWidth;
    this.heightNoAnnotations = displayHeight;
    this.bounds.setExtent(new Point(displayWidth, displayHeight));
};

ScriptDiagramMorph.prototype.render = function (ctx) {
    var img = this.scriptContainer.fullImage();
    ctx.drawImage(
        img, 0, 0, this.widthNoAnnotations, this.heightNoAnnotations
    );
};

ScriptDiagramMorph.prototype.fixLayout = function () {
    var annotationsHeight;
    this.arrows.forEach(function (arrow) {
        arrow.destroy();
    });
    this.arrows = [];
    annotationsHeight = this.addAnnotations();
    this.bounds.setHeight(Math.max(annotationsHeight, this.heightNoAnnotations));
};

ScriptDiagramMorph.prototype.addAnnotations = function () {
    var myself = this, minTop, annotationsHeight, horizontalArrows, i,
        lastCreated, annotation, arrow, arrowStart, arrowEnd,
        arrowStartMorph, arrowEndMorph, allArrows;

    minTop = this.top() + this.script.top() * this.scriptScale;
    annotationsHeight = 0;
    horizontalArrows = [];
    this.annotations.forEach(function (annotation, i) {
        if (annotation.annotationArrowHorizontal) {
            horizontalArrows.push(i);
        }
    });
    lastCreated = -1;

    horizontalArrows.forEach(function (arrowIdx) {
        var localMinTop = minTop, localMaxBottom = -1;
        for (i = arrowIdx; i > lastCreated; i--) {
            annotation = myself.addAnnotation(
                i + 1, localMinTop, localMaxBottom
            );
            if (annotation) {
                minTop = Math.max(minTop, annotation.bottom());
                localMaxBottom = annotation.top();
                annotationsHeight = Math.max(
                    annotationsHeight, annotation.bottom() - myself.top()
                );
            }
        }
        lastCreated = arrowIdx;
    });
    for (i = lastCreated + 1; i < this.annotations.length; i++) {
        annotation = this.addAnnotation(i + 1, minTop, -1);
        if (annotation) {
            minTop = annotation.bottom();
            annotationsHeight = Math.max(
                annotationsHeight, annotation.bottom() - this.top()
            );
        }
    }

    i = 1;
    while (true) {
        arrowStartMorph = this.getAnnotatedMorph('annotationArrowStart', i);
        if (!arrowStartMorph) {
            break;
        }
        arrowStart = this.position().add(
            arrowStartMorph.center().multiplyBy(this.scriptScale)
        );
        arrowEndMorph = this.getAnnotatedMorph('annotationArrowEnd', i);
        arrowEnd = this.position().add(
            arrowEndMorph.center().multiplyBy(this.scriptScale)
        );
        allArrows = arrowEndMorph.annotationArrowEnd
            .split(',')
            .map(function (n) {
                return +n;
            });
        if (allArrows.length > 1) {
            arrowEnd = arrowEnd.add(new Point(
                this.padding * (-allArrows.length + 1) / 2
                    + this.padding * allArrows.indexOf(i),
                0
            ));
        }
        arrow = new DiagramArrowMorph(
            arrowStart, arrowEnd, true,
            arrowStartMorph.annotationArrowReverse,
            arrowStartMorph.annotationArrowDetour || 0
        );
        arrow.color = arrowStartMorph.annotationArrowColor
                        || this.defaultArrowColor;
        arrow.fixLayout();
        annotationsHeight = Math.max(
            annotationsHeight, arrow.bottom() - this.top()
        );
        this.arrows.push(arrow);
        this.add(arrow);
        i += 1;
    }

    return annotationsHeight;
};

ScriptDiagramMorph.prototype.addAnnotation = function (
    id, minTop, maxBottom
) {
    var annotation, annotated, annotationX, annotationWidth,
        arrow, arrowStart, arrowEnd, lineHeight;

    annotationX = this.left() + this.widthNoBubble + this.margin;
    annotationWidth = this.right() - annotationX;

    annotation = this.annotations[id - 1];
    annotated = this.getAnnotatedMorph('annotationID', id);
    if (!annotated) {
        return null;
    }

    this.add(annotation);
    if (annotation.annotationArrowDetour) {
        arrowEnd = this.position().add(
            annotated.center().multiplyBy(this.scriptScale)
        );
    } else if (
        annotated instanceof CommandBlockMorph
        || annotated instanceof MenuItemMorph
        || annotated === annotated.topBlock()
    ) {
        arrowEnd = this.position().add(new Point(
            annotated.right() + this.padding,
            annotated.parts
                ? annotated.parts()[0].center().y
                : annotated.center().y
        ).multiplyBy(this.scriptScale));
    } else if (id === 1) {
        arrowEnd = this.position().add(new Point(
            annotated.right(),
            annotated.center().y
        ).multiplyBy(this.scriptScale));
    } else {
        arrowEnd = this.position().add(
            annotated.bottomCenter().multiplyBy(this.scriptScale)
        );
    }

    if (annotation instanceof TextMorph) {
        annotation.setWidth(annotationWidth);
    }

    if (annotation instanceof RichTextMorph) {
        lineHeight = annotation.calculateLineHeight(annotation.lines[0]);
    } else if (annotation instanceof TextMorph) {
        lineHeight = fontHeight(annotation.fontSize);
    } else {
        lineHeight = annotation.height();
    }

    annotation.setPosition(new Point(
        annotationX,
        arrowEnd.y - lineHeight / 2
    ));
    if (!annotation.annotationArrowHorizontal) {
        if (annotation.top() < minTop && minTop - annotation.top() > 3) {
            // Don't bother enforcing minTop if the change would be
            // miniscule. This will keep the annotation's arrow straight,
            // which looks better.
            annotation.setTop(minTop);
        }
        if (maxBottom > -1) {
            annotation.setBottom(Math.min(maxBottom, annotation.bottom()));
        }
    }

    arrowStart = new Point(
        annotation.left() - this.padding,
        annotation.top() + lineHeight / 2
    );

    arrow = new DiagramArrowMorph(
        arrowStart, arrowEnd, false,
        annotation.annotationArrowReverse,
        annotation.annotationArrowDetour || 0
    );
    arrow.color = annotation.annotationArrowColor || this.defaultArrowColor;
    arrow.fixLayout();
    this.arrows.push(arrow);
    this.add(arrow);

    return annotation;
};

ScriptDiagramMorph.prototype.getAnnotatedMorph = function (attribute, id) {
    function check (morph) {
        var i, result, ids, attrValue = morph[attribute];
        if (attrValue) {
            ids = attrValue.split(',').map(function (n) {
                return +n;
            });
            if (contains(ids, id)) {
                return morph;
            }
        }
        for (i = 0; i < morph.children.length; i++) {
            result = check(morph.children[i]);
            if (result) {
                return result;
            }
        }
        return null;
    }
    return check(this.scriptContainer);
};

// DiagramArrowMorph ////////////////////////////////////////////////////

// DiagramArrowMorph inherits from Morph:

DiagramArrowMorph.prototype = new Morph();
DiagramArrowMorph.prototype.constructor = DiagramArrowMorph;
DiagramArrowMorph.uber = Morph.prototype;

function DiagramArrowMorph(start, end, scriptToScript, reverse, detourSize) {
    this.init(start, end, scriptToScript, reverse, detourSize);
}

DiagramArrowMorph.prototype.init = function (
    start,
    end,
    scriptToScript,
    reverse,
    detourSize
) {
    // additional properties:
    this.start = start;
    this.end = end;
    // scriptToScript means the arrow is contained entirely within the
    // annotated script (no outside annotation)
    this.scriptToScript = scriptToScript;
    this.reverse = reverse;
    this.detourSize = detourSize;
    this.padding = 5 + detourSize;

    // initialize inherited properties:
    DiagramArrowMorph.uber.init.call(this);
};

DiagramArrowMorph.prototype.fixLayout = function () {
    this.bounds.setExtent(
        this.end.subtract(this.start).abs().add(this.padding * 2)
    );
    this.setPosition(this.start.min(this.end).subtract(this.padding));
};

DiagramArrowMorph.prototype.render = function (ctx) {
    var start, end, oldStart, theta, r, detourSize, x, y;

    r = 5; // arrow head size
    detourSize = this.detourSize;

    start = new Point(
        this.start.x < this.end.x
            ? this.padding
            : this.width() - this.padding,
        this.start.y < this.end.y
            ? this.padding
            : this.height() - this.padding
    );
    end = new Point(
        this.start.x < this.end.x
            ? this.width() - this.padding
            : this.padding,
        this.start.y < this.end.y
            ? this.height() - this.padding
            : this.padding
    );
    if (this.reverse) {
        oldStart = start;
        start = end;
        end = oldStart;
    }

    ctx.strokeStyle = ctx.fillStyle = this.color.toString();

    theta = end.subtract(start).theta();
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.moveTo(x = start.x, y = start.y);
    if (detourSize > 0) {
        if (!this.scriptToScript) {
            ctx.lineTo(
                x = x + detourSize * Math.cos(theta),
                y = y + detourSize * Math.sin(theta)
            );
        }
        theta -= Math.PI / 2;
        ctx.lineTo(
            x = x + detourSize * Math.cos(theta),
            y = y + detourSize * Math.sin(theta)
        );
        theta += Math.PI;
        ctx.lineTo(
            x = end.x - detourSize * Math.cos(theta),
            y = end.y - detourSize * Math.sin(theta)
        );
    }
    end = end.subtract(new Point (
        r * Math.cos(theta), r * Math.sin(theta)
    ));
    ctx.lineTo(x = end.x, y = end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(
        x = end.x + r * Math.cos(theta),
        y = end.y + r * Math.sin(theta)
    );
    theta += 2/3 * Math.PI;
    ctx.lineTo(
        x = end.x + r * Math.cos(theta),
        y = end.y + r * Math.sin(theta)
    );
    theta += 2/3 * Math.PI;
    ctx.lineTo(
        x = end.x + r * Math.cos(theta),
        y = end.y + r * Math.sin(theta)
    );
    ctx.closePath();
    ctx.fill();
};

// BlockMorph ///////////////////////////////////////////////////////////

BlockMorph.prototype.addDiagramHighlight = function (oldHighlight) {
    var isHidden = !this.isVisible,
        oldUseBlurredShadows = useBlurredShadows,
        highlight;

    if (isHidden) {this.show(); }
    useBlurredShadows = false;
    highlight = this.highlight(
        oldHighlight ? oldHighlight.color : new Color(0, 255, 0),
        10,
        2
    );
    useBlurredShadows = oldUseBlurredShadows;
    this.addBack(highlight);
    this.fullChanged();
    if (isHidden) {this.hide(); }
    return highlight;
};

// ArgMorph /////////////////////////////////////////////////////////////

ArgMorph.prototype.addDiagramHighlight = BlockMorph.prototype.addDiagramHighlight;
