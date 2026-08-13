#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

// Based on code from https://gist.github.com/sephirot47/f942b8c252eb7d1b7311

// these constants are used throughout the shader,
// they can be altered to avoid glitches or optimize the framerate,
// their meaning can best be seen in context below
#define NEAR_CLIPPING_PLANE 0.1
#define FAR_CLIPPING_PLANE 100.0
#define NUMBER_OF_MARCH_STEPS 40
#define EPSILON 0.01
#define DISTANCE_BIAS 0.7

float fmod(float a, float b)
{
    if(a<0.0)
    {
        return b - mod(abs(a), b);
    }
    return mod(a, b);
}

float udBox( vec3 p, vec3 c, vec3 b )
{
  return length(max(abs(p-c)-b,0.0));
}

// distance to sphere function (p is world position of the ray, s is sphere radius)
// from http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdSphere(vec3 p, vec3 c, float s)
{
    return length(p - c) - s;
}

vec2 scene(vec3 position)
{
    /*
    This function generates a distance to the given position
    The distance is the closest point in the world to that position
    */
    // to move the sphere one unit forward, we must subtract that translation from the world position
    vec3 translate = vec3(0.0, -0.5, 1.0);
    vec3 p = position - translate;
    float distance = sdSphere(p, vec3(1,1,1), 0.5);
    distance = min(distance, udBox(p, vec3(-1,1,1),  vec3(0.1,0.2,0.3)));
    float materialID = 1.0;

    // we return a vec2 packing the distance and material of the closes object together
    return vec2(distance, materialID);
}

vec2 raymarch(vec3 position, vec3 direction)
{
    /*
    This function iteratively analyses the scene to approximate the closest ray-hit
    */
    // We track how far we have moved so we can reconstruct the end-point later
    float total_distance = NEAR_CLIPPING_PLANE;
    for(int i = 0 ; i < NUMBER_OF_MARCH_STEPS ; ++i)
    {
        vec2 result = scene(position + direction * total_distance);
        // If our ray is very close to a surface we assume we hit it
        // and return it's material
        if(result.x < EPSILON)
        {
            return vec2(total_distance, result.y);
        }

        // Accumulate distance traveled
        // The result.x contains closest distance to the world
        // so we can be sure that if we move it that far we will not accidentally
        // end up inside an object. Due to imprecision we do increase the distance
        // by slightly less... it avoids normal errors especially.
        total_distance += result.x * DISTANCE_BIAS;

        // Stop if we are headed for infinity
        if(total_distance > FAR_CLIPPING_PLANE)
            break;
    }
    // By default we return no material and the furthest possible distance
    // We only reach this point if we didn't get close to a surface during the loop above
    return vec2(FAR_CLIPPING_PLANE, 0.0);
}

void main (void) {
    vec2 uv = gl_FragCoord.xy/u_resolution.xy;

    // Our rays should shoot left and right, so we move the 0-1 space and make it -1 to 1
    uv = uv * 2.0 - 1.0;

    // // Last we deal with an aspect ratio in the window, to make sure our results are square
    // // we must correct the X coordinate by the stretching of the resolution
    // uv.x *= iResolution.x / iResolution.y;

    // Now to conver the UV to a ray we need a camera origin, like 0,0,0; and a direction
    // We can use the -1 to 1 UVs as ray X and Y, then we make sure the direction is length 1.0
    // by adding a Z component. Code blow is just an example:
    //float sqr_length = dot(uv, uv);
    //vec3 direction = vec3(uv, sqrt(1.0 - sqr_length));

    // a shorter and easier way is to create a vec3 and normalise it,
    // we can manually change the Z component to change the final FOV;
    // smaller Z is bigger FOV
    vec3 direction = normalize(vec3(uv, 2.5));
    // if you rotate the direction with a rotation matrix you can turn the camera too!

    vec3 camera_origin = vec3(0.0, 0.0, -2.5); // you can move the camera here

    vec2 result = raymarch(camera_origin, direction); // this raymarches the scene

    // now let's pick a color
    vec3 materialColor = vec3(0.0, 0.0, 0.0);
    if(result.y == 1.0)
    {
        materialColor = vec3(1.0, 0.25, 0.1);
    }
    if(result.y == 2.0)
    {
        materialColor = vec3(0.7, 0.7, 0.7);
    }

    gl_FragColor = vec4(materialColor, 1);
}
