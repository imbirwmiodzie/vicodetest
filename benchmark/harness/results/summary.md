# Benchmark summary

Source: `results/benchmark-raw.json`, 27 successful runs. Values are medians over runs; [min-max] across runs.

## CPU throttle 1x

| Metric | remotion | hyperframes | revideo |
|---|---:|---:|---:|
| Avg FPS (rAF) | 60.0 [60.0-60.0] | 60.0 [60.0-60.0] | 60.0 [60.0-60.0] |
| 5th-percentile FPS (rAF) | 59.9 [59.9-59.9] | 59.9 [59.5-59.9] | 59.9 [59.9-59.9] |
| Frames > 50 ms (per 30 s) | 0 [0-0] | 0 [0-0] | 0 [0-0] |
| Animation updates / s | 30.0 [30.0-30.0] | 119.9 [119.9-120.0] | 30.0 [30.0-30.0] |
| Playback rate (anim s / wall s, ideal 1.00) | 1.00 [1.00-1.00] | 1.00 [1.00-1.00] | 1.00 [0.99-1.00] |
| Main-thread busy % | 4 [4-5] | 7 [6-8] | 15 [15-18] |
| Script % | 2 [2-3] | 3 [3-3] | 1 [1-1] |
| Style + layout % | 0 [0-0] | 1 [1-1] | 1 [1-1] |
| CPU, all Chromium processes (% of 1 core) | 13 [12-15] | 22 [20-24] | 24 [23-28] |
|   renderer process | 10 [9-12] | 17 [16-19] | 19 [18-22] |
|   GPU process | 3 [2-3] | 4 [3-4] | 5 [4-6] |
| JS heap used @60 s (MB) | 7.2 [7.1-7.9] | 6.0 [5.6-8.0] | 9.8 [9.7-10.4] |
| JS heap after GC @60 s (MB) | 4.2 [4.2-4.2] | 4.1 [4.1-4.1] | 7.1 [7.1-7.1] |
| Total PSS, all processes @60 s (MB) | 319 [318-320] | 323 [321-323] | 319 [317-319] |
|   renderer PSS (MB) | 93 [93-94] | 97 [97-97] | 109 [109-109] |
| Time to first frame (ms) | 184 [175-185] | 181 [166-227] | 252 [240-284] |
| Config update latency, median (ms) | 18 [18-23] | 23 [20-25] | 76 [76-81] |
| Latency samples not detected | 0 | 0 | 0 |

## CPU throttle 4x

| Metric | remotion | hyperframes | revideo |
|---|---:|---:|---:|
| Avg FPS (rAF) | 59.9 [59.8-60.0] | 60.0 [59.9-60.0] | 58.8 [58.2-58.9] |
| 5th-percentile FPS (rAF) | 59.5 [59.5-59.5] | 59.9 [59.9-59.9] | 59.5 [59.5-59.5] |
| Frames > 50 ms (per 30 s) | 0 [0-1] | 0 [0-0] | 5 [5-5] |
| Animation updates / s | 29.9 [29.9-30.0] | 119.8 [103.8-119.9] | 29.7 [29.6-29.8] |
| Playback rate (anim s / wall s, ideal 1.00) | 1.00 [1.00-1.00] | 1.00 [1.00-1.00] | 0.99 [0.98-0.99] |
| Main-thread busy % | 18 [14-20] | 25 [25-30] | 63 [58-64] |
| Script % | 9 [7-10] | 11 [11-12] | 4 [4-4] |
| Style + layout % | 1 [1-2] | 3 [3-4] | 4 [4-4] |
| CPU, all Chromium processes (% of 1 core) | 97 [95-98] | 103 [102-106] | 107 [105-108] |
|   renderer process | 93 [92-95] | 98 [98-101] | 102 [101-103] |
|   GPU process | 3 [2-3] | 3 [3-4] | 5 [4-5] |
| JS heap used @60 s (MB) | 5.5 [5.5-6.5] | 6.5 [5.5-6.5] | 10.2 [8.5-11.7] |
| JS heap after GC @60 s (MB) | 4.2 [4.2-4.2] | 4.1 [4.1-4.1] | 7.2 [7.2-7.2] |
| Total PSS, all processes @60 s (MB) | 320 [319-321] | 322 [322-324] | 317 [317-320] |
|   renderer PSS (MB) | 93 [93-93] | 97 [97-97] | 110 [110-111] |
| Time to first frame (ms) | 540 [534-541] | 538 [486-555] | 868 [801-1062] |
| Config update latency, median (ms) | 26 [20-26] | 30 [28-33] | 231 [217-233] |
| Latency samples not detected | 0 | 0 | 0 |

## CPU throttle 6x

| Metric | remotion | hyperframes | revideo |
|---|---:|---:|---:|
| Avg FPS (rAF) | 59.9 [59.7-60.0] | 60.0 [59.9-60.0] | 45.5 [41.9-48.8] |
| 5th-percentile FPS (rAF) | 59.5 [59.5-59.9] | 59.9 [59.5-59.9] | 20.0 [20.0-29.9] |
| Frames > 50 ms (per 30 s) | 0 [0-1] | 0 [0-0] | 27 [25-39] |
| Animation updates / s | 29.9 [29.8-30.0] | 103.8 [103.7-103.8] | 27.4 [27.3-28.1] |
| Playback rate (anim s / wall s, ideal 1.00) | 1.00 [1.00-1.00] | 1.00 [1.00-1.00] | 0.91 [0.91-0.93] |
| Main-thread busy % | 27 [26-29] | 43 [34-46] | 90 [86-92] |
| Script % | 14 [13-14] | 18 [14-19] | 6 [6-6] |
| Style + layout % | 2 [2-2] | 5 [4-5] | 6 [6-7] |
| CPU, all Chromium processes (% of 1 core) | 105 [105-105] | 113 [109-114] | 113 [112-115] |
|   renderer process | 101 [101-102] | 108 [105-109] | 109 [108-110] |
|   GPU process | 3 [3-3] | 4 [3-4] | 5 [4-5] |
| JS heap used @60 s (MB) | 5.6 [5.5-8.5] | 6.1 [5.9-6.2] | 13.4 [10.1-13.6] |
| JS heap after GC @60 s (MB) | 4.2 [4.1-4.2] | 4.1 [4.1-4.2] | 7.1 [7.1-7.1] |
| Total PSS, all processes @60 s (MB) | 320 [319-320] | 323 [322-323] | 320 [318-322] |
|   renderer PSS (MB) | 94 [93-94] | 97 [97-98] | 113 [111-113] |
| Time to first frame (ms) | 843 [737-1117] | 864 [826-974] | 1325 [1298-1473] |
| Config update latency, median (ms) | 27 [25-29] | 40 [31-43] | 348 [343-351] |
| Latency samples not detected | 0 | 0 | 0 |

## External requests during runs

None.
