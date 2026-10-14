export const GLOBAL_FRAGMENT_SHADER = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uClouds;
  uniform sampler2D uBorders;
  uniform vec3 uSunDirection;
  uniform vec3 uSunViewDirection;
  uniform float uCloudOffset;
  uniform float uMapStyle;
  uniform float uZoom;
  uniform vec2 uDayTexel;
  varying vec2 vUv;
  varying vec3 vSurfaceNormal;
  varying vec3 vViewNormal;

  void main() {
    vec3 surfaceNormal = normalize(vSurfaceNormal);
    vec3 viewNormal = normalize(vViewNormal);
    float sunlight = dot(surfaceNormal, normalize(uSunDirection));
    float daylight = smoothstep(-0.09, 0.14, sunlight);
    float sunStrength = max(sunlight, 0.0);

    vec3 surface = texture2D(uDay, vUv).rgb;
    vec3 nightMap = texture2D(uNight, vUv).rgb;
    vec2 borders = texture2D(uBorders, vUv).rg;
    float cloudMap = texture2D(uClouds, vec2(fract(vUv.x + uCloudOffset), vUv.y)).r;
    float clouds = smoothstep(0.20, 0.82, cloudMap);
    float cloudOpacity = mix(1.0, 0.28, smoothstep(1.5, 4.0, uZoom));
    float ocean = smoothstep(0.035, 0.105, surface.b - max(surface.r, surface.g));

    vec3 day = surface * (0.98 + 0.12 * sunStrength);
    day *= 1.0 - clouds * 0.12 * cloudOpacity;
    vec3 cloudColor = vec3(0.84, 0.90, 0.96) * (0.92 + 0.08 * sunStrength);
    day = mix(day, cloudColor, clouds * 0.72 * cloudOpacity);
    day = pow(day, vec3(0.82));
    day = mix(day, max(day, vec3(0.18, 0.40, 0.62)), ocean * 0.72);

    vec3 reflectedSun = reflect(-normalize(uSunViewDirection), viewNormal);
    float glint = pow(max(dot(reflectedSun, vec3(0.0, 0.0, 1.0)), 0.0), 62.0);
    day += vec3(0.33, 0.55, 0.82) * glint * ocean * (1.0 - clouds * 0.75) * 0.62;

    vec3 night = nightMap * 1.22 + vec3(0.001, 0.003, 0.008);
    night += clouds * vec3(0.013, 0.025, 0.043) * cloudOpacity;

    if (uMapStyle > 1.5) {
      float longitude = min(fract(vUv.x * 12.0), 1.0 - fract(vUv.x * 12.0)) / 12.0;
      float latitude = min(fract(vUv.y * 12.0), 1.0 - fract(vUv.y * 12.0)) / 12.0;
      float meridian = 1.0 - smoothstep(0.00015, 0.00085, longitude);
      float parallel = 1.0 - smoothstep(0.00015, 0.00085, latitude);
      float grid = max(meridian, parallel);
      float majorLongitude = min(fract(vUv.x * 4.0), 1.0 - fract(vUv.x * 4.0)) / 4.0;
      float majorLatitude = min(fract(vUv.y * 4.0), 1.0 - fract(vUv.y * 4.0)) / 4.0;
      float majorGrid = 1.0 - smoothstep(0.0002, 0.0013, min(majorLongitude, majorLatitude));
      float nodes = 1.0 - smoothstep(0.0005, 0.0027, length(vec2(longitude, latitude)));
      float globeGrid = 1.0 - step(1.001, uZoom);
      vec2 coastStep = uDayTexel * mix(1.0, 2.5, smoothstep(1.0, 5.0, uZoom));
      vec3 smoothSurface = (
        surface * 4.0 +
        texture2D(uDay, vUv + vec2(-coastStep.x, 0.0)).rgb +
        texture2D(uDay, vUv + vec2( coastStep.x, 0.0)).rgb +
        texture2D(uDay, vUv + vec2(0.0, -coastStep.y)).rgb +
        texture2D(uDay, vUv + vec2(0.0,  coastStep.y)).rgb
      ) * 0.125;
      float smoothOcean = smoothstep(0.035, 0.105, smoothSurface.b - max(smoothSurface.r, smoothSurface.g));
      float coast = 1.0 - smoothstep(0.08, 0.30, abs(smoothOcean - 0.5));
      float vegetation = smoothstep(-0.015, 0.12, smoothSurface.g - smoothSurface.r);
      vec3 land = mix(vec3(0.48, 0.74, 0.82), vec3(0.38, 0.70, 0.79), vegetation);
      vec3 sea = vec3(0.22, 0.54, 0.72);
      vec3 hologram = mix(land, sea, smoothOcean);
      hologram *= 0.94 + 0.06 * daylight;
      hologram = mix(hologram, vec3(0.16, 0.48, 0.67), grid * 0.28 * globeGrid);
      hologram = mix(hologram, vec3(0.12, 0.43, 0.61), majorGrid * 0.38 * globeGrid);
      hologram = mix(hologram, vec3(0.08, 0.38, 0.54), nodes * 0.45 * globeGrid);
      hologram = mix(hologram, vec3(0.12, 0.48, 0.63), coast * 0.65);
      hologram = mix(hologram, vec3(0.09, 0.37, 0.52), borders.r * mix(0.78, 0.90, smoothstep(1.0, 3.0, uZoom)));
      hologram = mix(hologram, vec3(0.28, 0.48, 0.40), borders.g * 0.80);
      float hologramRim = pow(1.0 - max(viewNormal.z, 0.0), 4.0);
      hologram += vec3(0.05, 0.18, 0.24) * hologramRim;
      gl_FragColor = vec4(hologram, 1.0);
      return;
    }

    if (uMapStyle > 0.5) {
      float terrain = dot(surface, vec3(0.30, 0.59, 0.11));
      vec3 land = mix(vec3(0.48, 0.68, 0.70), vec3(0.84, 0.92, 0.90), smoothstep(0.12, 0.65, terrain));
      vec3 sea = mix(vec3(0.28, 0.58, 0.67), vec3(0.48, 0.74, 0.80), smoothstep(0.08, 0.24, surface.b));
      vec3 atlas = mix(land, sea, ocean);
      day = atlas * (0.96 + 0.08 * sunStrength);
      day = mix(day, vec3(0.86, 0.92, 0.93), clouds * 0.24 * cloudOpacity);
    }

    vec3 color = uMapStyle < 0.5
      ? mix(night + day * 0.10, day, daylight)
      : mix(day * 0.88 + night * 0.20, day, daylight);
    float colorBrightness = dot(color, vec3(0.30, 0.59, 0.11));
    vec3 borderColor = uMapStyle > 0.5
      ? vec3(0.28, 0.58, 0.68)
      : mix(vec3(0.68, 0.80, 0.64), vec3(0.10, 0.20, 0.17), smoothstep(0.38, 0.58, colorBrightness));
    float borderOpacity = uMapStyle > 0.5
      ? mix(0.78, 0.86, smoothstep(1.0, 3.0, uZoom))
      : mix(0.52, 0.95, smoothstep(1.0, 3.0, uZoom));
    color = mix(color, borderColor, borders.r * borderOpacity);
    color = mix(color, vec3(0.91, 0.58, 0.31), borders.g * borderOpacity);

    float limb = pow(1.0 - max(viewNormal.z, 0.0), 3.3);
    float thinRim = pow(1.0 - max(viewNormal.z, 0.0), 9.0);
    color += vec3(0.035, 0.14, 0.30) * limb;
    color += vec3(0.13, 0.38, 0.66) * thinRim * (0.38 + 0.62 * daylight);

    float twilight = 1.0 - smoothstep(0.0, 0.14, abs(sunlight));
    color += mix(vec3(0.12, 0.045, 0.012), vec3(0.045, 0.07, 0.09), step(0.5, uMapStyle)) * twilight * (0.35 + 0.65 * limb);
    gl_FragColor = vec4(color, 1.0);
  }
`
