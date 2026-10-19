# Automatic detail telemetry

NaijaChase measures whether Automatic graphics makes good decisions without
recording player identity or gameplay content. The browser batches at most 20
events to `POST /v1/telemetry/performance`. Delivery uses `sendBeacon` when
possible and never blocks or breaks gameplay.

## Measurements

- `detail_selection`: requested choice, resolved level/renderer/model use, and
  the plain fallback/selection reason.
- `model_load`: versioned model path, downloaded bytes, download milliseconds,
  decode milliseconds, and loading priority.
- `frame_rate`: periodic FPS samples while a shared 3D stage is active.
- `webgl_context_lost`: a lost shared-stage WebGL context.
- `scene_fallback`: scene family and bounded failure reason.
- `web_vital`: FCP, LCP, CLS and INP where the browser supports the relevant
  Performance Observer entry type.

Every event includes only `device_class` (`low`, `mid`, `high`), coarse
`connection_type`, `save_data`, and `viewport_class`. It does not include an IP
in the event, player/account ID, full user agent, exact hardware values, query
string, case ID, witness text or location. Normal web-server access logs may
still contain an IP and remain subject to the production retention policy.

The API accepts only documented event kinds and keys, primitive values, strings
up to 512 bytes, and 20 events per request. Accepted events appear in structured
logs with message `browser performance`; Prometheus exposes only the aggregate
accepted-event count as `naijachase_browser_performance_events_total`.

## Production analysis

Aggregate structured events by release, event kind, device class and connection
type. Compare:

- Automatic resolution counts and fallback rates;
- p50/p75/p95 model download and decode time by model path;
- p50/p75 frame rate and WebGL-loss rate;
- p75 FCP, LCP, CLS and INP;
- explicit Full users on slow or data-saving connections separately from
  Automatic users.

Do not reduce Automatic thresholds from a small or launch-day-only sample.
Collect at least seven representative days and require a meaningful cohort in
each device/connection bucket. Adjust one threshold per release, record the
before/after fallback and Web Vital results, and roll back if the change worsens
p75 rendering or fallback rate. The checklist's threshold-tuning item stays
open until this production evidence exists.
