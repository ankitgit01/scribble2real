# Workshop runbook

Keep this page open on the laptop that hosts the workshop.

## Before students arrive

1. Plug in the laptop, set performance mode, and prevent sleep or screen lock during the session.
2. Close other GPU-heavy apps and check there is enough disk space for model caches.
3. Confirm `MENTOR_PIN` is set in `backend/.env`. Keep it with the mentor; do not show it on the projector.
4. Start the app with `scripts/start.ps1` (Windows) or `scripts/start.sh` (Linux). Confirm the terminal reports the GPU and join links.
5. Open `/mentor` on the laptop, enter the PIN, and confirm queue, Learn usage, and student controls load.
6. Make one test sketch and generate an image. This warms the model and gives a realistic latency check.
7. Join from a phone on the workshop Wi-Fi. If the laptop link does not open, try a hotspot or start the optional tunnel.
8. Keep the charger connected, airflow clear, and a set of pre-generated example images available for a non-GPU backup activity.

## During the session

- Use the banner for a short shared drawing prompt, for example “Draw a plant cell”.
- Watch queue length and Learn usage. Pause new jobs before changing settings or handling a long queue.
- Ask students to work in pairs or rounds if the queue grows beyond the class's wait-time target.
- Keep the PIN private. Block a device if it is disrupting the session; clear queued work if needed.

## Quick responses

| Issue | What to do |
|---|---|
| GPU out of memory | Pause new work. Restart the server, close other GPU apps, then use the `fast` quality setting. If memory remains full, switch to the example-image activity. |
| Server stops | Note the terminal error, then rerun `scripts/start.ps1` or `scripts/start.sh`. A queued job may need to be submitted again. |
| Students cannot reach the laptop | Confirm both devices are on the same Wi-Fi. School networks may isolate devices; use a phone hotspot or the quick tunnel. |
| Gemini or Learn quota is reached | Turn explanations off in the dashboard, or configure another available provider and restart the server. Image generation can continue without Learn. |
| Inappropriate request or disruption | Pause the workshop if needed, block that device, clear waiting jobs, and resume when ready. Follow your institution's safeguarding process. |
| Laptop heats or slows down | Improve airflow, reduce quality to `fast`, let it cool, and move to pairs or rounds. |
| GPU fails completely | Stop generation and use the prepared example results as a discussion activity. Do not promise live image creation until the GPU is healthy again. |

## Stop and close

Stop the server with `Ctrl+C`. Stop the tunnel in its own terminal; its temporary public URL is cleared on exit. Review any session concerns with the workshop lead. Activity data is held in memory by the service and is lost when it stops.
