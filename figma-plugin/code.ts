// Truv Ad Generator - Figma Plugin
// Select any frame → identify text components → paste variations → generate clones

figma.showUI(__html__, { width: 360, height: 600 });
figma.skipInvisibleInstanceChildren = true;

interface TextComponent {
  id: string;
  layerName: string;
  currentText: string;
}

interface VariationInput {
  layerName: string;
  variations: string[];
}

// Recursively find all text nodes in a subtree
function findAllTextNodes(node: SceneNode): TextNode[] {
  const results: TextNode[] = [];
  if (node.type === 'TEXT') {
    results.push(node);
  }
  if ('children' in node) {
    for (const child of node.children) {
      results.push(...findAllTextNodes(child));
    }
  }
  return results;
}

// Find a text node by layer name within a subtree
function findTextNodeByName(parent: SceneNode, name: string): TextNode | null {
  if (parent.type === 'TEXT' && parent.name === name) {
    return parent;
  }
  if ('children' in parent) {
    for (const child of parent.children) {
      const found = findTextNodeByName(child, name);
      if (found) return found;
    }
  }
  return null;
}

// Load all fonts used in a text node
async function loadFontsForNode(node: TextNode): Promise<void> {
  const len = node.characters.length;
  if (len === 0) {
    // For empty text nodes, load the default font
    const font = node.fontName;
    if (font !== figma.mixed) {
      await figma.loadFontAsync(font);
    }
    return;
  }
  const fontNames = node.getRangeAllFontNames(0, len);
  for (const font of fontNames) {
    try {
      await figma.loadFontAsync(font);
    } catch {
      // Font not available — skip gracefully
    }
  }
}

// Handle messages from UI
figma.ui.onmessage = async (msg: any) => {

  // Step 1: Identify text components in the selected frame
  if (msg.type === 'identify-components') {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1) {
      figma.ui.postMessage({
        type: 'error',
        message: selection.length === 0
          ? 'No frame selected. Select a frame first, then click Identify.'
          : 'Select just one frame at a time.'
      });
      return;
    }

    const frame = selection[0];
    if (frame.type !== 'FRAME' && frame.type !== 'COMPONENT' && frame.type !== 'INSTANCE' && frame.type !== 'GROUP') {
      figma.ui.postMessage({
        type: 'error',
        message: 'Selected node is not a frame or group. Select a frame containing text layers.'
      });
      return;
    }

    const textNodes = findAllTextNodes(frame);
    if (textNodes.length === 0) {
      figma.ui.postMessage({
        type: 'error',
        message: 'No text layers found in the selected frame.'
      });
      return;
    }

    const components: TextComponent[] = textNodes.map(node => ({
      id: node.id,
      layerName: node.name,
      currentText: node.characters.substring(0, 60)
    }));

    figma.ui.postMessage({
      type: 'components-found',
      components,
      frameName: frame.name,
      frameWidth: Math.round(frame.width),
      frameHeight: Math.round(frame.height)
    });
  }

  // Step 3: Generate variations
  if (msg.type === 'generate') {
    const inputs: VariationInput[] = msg.components;
    const selection = figma.currentPage.selection;

    if (selection.length !== 1) {
      figma.ui.postMessage({ type: 'error', message: 'Original frame is no longer selected. Re-select it and try again.' });
      return;
    }

    const sourceFrame = selection[0] as FrameNode;

    // Determine how many variations to create
    const maxVariations = Math.max(...inputs.map(c => c.variations.length));
    if (maxVariations === 0) {
      figma.ui.postMessage({ type: 'error', message: 'No variations entered.' });
      return;
    }

    // Create container frame
    const container = figma.createFrame();
    container.name = `[GENERATED] Variations - ${new Date().toISOString().split('T')[0]}`;
    container.layoutMode = 'VERTICAL';
    container.itemSpacing = 40;
    container.primaryAxisSizingMode = 'AUTO';
    container.counterAxisSizingMode = 'AUTO';
    container.fills = [];

    // Position to the right of existing content
    let maxX = 0;
    for (const node of figma.currentPage.children) {
      if (node === container) continue;
      const right = node.x + node.width;
      if (right > maxX) maxX = right;
    }
    container.x = maxX + 200;
    container.y = 0;

    let generated = 0;

    for (let i = 0; i < maxVariations; i++) {
      const clone = sourceFrame.clone();

      // Build a label from the first variation input
      const firstInput = inputs[0];
      const labelText = firstInput.variations[Math.min(i, firstInput.variations.length - 1)];
      clone.name = `Variation ${i + 1} | ${labelText.substring(0, 40)}`;

      // Swap text for each component
      for (const input of inputs) {
        const textNode = findTextNodeByName(clone, input.layerName);
        if (textNode) {
          await loadFontsForNode(textNode);
          // Use the ith variation, or the last one if fewer were provided
          const varIndex = Math.min(i, input.variations.length - 1);
          textNode.characters = input.variations[varIndex];
        }
      }

      container.appendChild(clone);
      generated++;

      // Export PNG at 2x
      try {
        const pngBytes = await clone.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 2 },
        });
        const safeName = labelText
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .toLowerCase()
          .substring(0, 50);
        figma.ui.postMessage({
          type: 'export-png',
          fileName: `variation-${i + 1}-${safeName}.png`,
          bytes: pngBytes,
        });
      } catch {
        // PNG export failed for this frame — continue
      }

      figma.ui.postMessage({
        type: 'progress',
        text: `Generated ${generated} of ${maxVariations}`,
        percent: Math.round((generated / maxVariations) * 100),
        log: `✓ Variation ${i + 1}: ${labelText.substring(0, 50)}`
      });
    }

    // Zoom to container
    figma.viewport.scrollAndZoomIntoView([container]);

    figma.ui.postMessage({
      type: 'done',
      count: generated
    });

    figma.notify(`Generated ${generated} ad variations.`);
  }
};
