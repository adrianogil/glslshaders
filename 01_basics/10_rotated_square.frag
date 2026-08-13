#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

vec2 rotate_point(vec2 center,float angle, vec2 p)
{
  float s = sin(angle);
  float c = cos(angle);

  // translate point back to origin:
  p.x = p.x - center.x;
  p.y = p.y - center.y;

  // rotate point
  float xnew = p.x * c - p.y * s;
  float ynew = p.x * s + p.y * c;

  // translate point back:
  p.x = xnew + center.x;
  p.y = ynew + center.y;
  
  return p;
}

float square(vec2 uv, vec2 center, float size)
{
    uv = rotate_point(center, 45.0 * 3.14159265359 / 180.0, uv);

    float diffx = abs(uv.x - center.x);
    float diffy = abs(uv.y - center.y);

    // vec2 diff = vec2(diffx, diffy);
    // diff = rotate_point(vec2(0.0, 0.0), 40.0 * 3.14159265359 / 180.0, diff);
    
    if (diffx <= size && diffy <= size)
    {
        return 0.1 + 0.9 * max(diffx, diffy) / 0.2;
        // return 0.5;
    }
    return 0.0;
}

void main (void) {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;

    float scale = 1.0;

    vec2 uv = scale * 2.0 * (st - vec2(0.5, 0.5));

    float value = square(uv, vec2(0, 0), 0.1);

    vec3 color = vec3(value, 0.0, 0.0);

    if (abs(value) > 0.1)
    {
        color = vec3(value, 0.5 * cos(3.14 * 10.0 * value) * uv.x + 0.5, 0.5 * uv.y + 0.5);
        //color = vec3(value, 0.0, 0.0);
    } else
    {
        color = vec3(0.0);
    }

    gl_FragColor = vec4(color,1.0);
}
