const SEMITONES: { [key: string]: number } = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
};

export function noteToFrequency(label: string): number {
  const match = label.match(/^([A-G]#?)(\d)$/);
  if (!match) {
    return 440;
  }
  const midi = SEMITONES[match[1]] + (parseInt(match[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
