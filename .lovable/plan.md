# Add photo-based math solving to JoyNinjaMath

## Goal
Let someone choose a photo or take one with their phone, have JoyNinjaMath read the problem, and return a clear answer with step-by-step working.

## User experience
- Add a compact **Scan a problem** option alongside the existing typed input.
- Open the device camera/gallery through the normal picture picker.
- Show the selected image with controls to replace or remove it.
- Enable **Solve picture** only after a valid image is selected.
- While the picture is being read, show a clear analyzing state and prevent duplicate submissions.
- Display the recognized question, final answer, and numbered working in the existing solution area.
- Keep typed questions, topic buttons, and recent typed problems working as they do now.
- Show specific, friendly messages for unreadable pictures, unsupported files, oversized images, and AI service or credit errors.

## Visual direction
- Preserve JoyNinjaMath’s warm paper, ink, and sienna design tokens and current typography.
- Adapt the useful parts of the supplied example—picture picker, preview, and solve action—without replacing the existing app or introducing its blue/Arial card design.
- Make the controls comfortable on phones and allow direct camera capture where the browser supports it.

## Technical details
- Enable Lovable Cloud support for the server-side AI request and provision the project’s Lovable AI key if needed; the key will never be exposed in the browser.
- Add the required AI SDK packages and a server-only gateway helper.
- Add a validated server function that accepts one JPG, PNG, or WebP image, sends it to `openai/gpt-6-astra` as multimodal input, and requests structured output containing the recognized question, answer, and ordered explanation steps.
- Stream the model request internally as required for longer reasoning, then return the completed structured result to the page.
- Validate file type and size before sending, convert the selected image to a data URL in the browser, and clean up preview URLs when replaced.
- Preserve upstream safe error messages and only retry transient rate-limit/server failures with bounded delay.
- Extend the solution display to support photo results without weakening the existing exact arithmetic solver.
- Complete the page’s required social metadata fields while touching the route.

## Verification
- Test selecting, previewing, replacing, removing, and solving a sample math image.
- Confirm a photographed arithmetic problem produces a transcription, answer, and ordered steps.
- Confirm invalid and unreadable images produce helpful errors and do not erase the selected picture.
- Confirm typed solving still works for arithmetic, fractions, decimals, and percentages.
- Check the finished page at desktop and phone widths with no overlap or browser errors.
