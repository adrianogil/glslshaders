#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

void main (void) {

    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st = st * 2.0 - 1.0; // Transforming the space to go from -1 to 1
    vec2 center = vec2(0.0, 0.0); // Center of the screen
    float size = 0.4; // Size of the flower

    // Calculate the angle and radius for the current fragment
    vec2 position = st - center;
    float angle = atan(position.y, position.x);
    float radius = length(position);

    // Normalize the angle between 0 and 2*PI
    if (angle < 0.0) angle += 2.0 * 3.14159265;

    // Calculate the flower vertices and check if the fragment is inside one of the arms
    bool inside = false;
    for (int i = 0; i < 5; ++i)
    {
        float vertexAngle = 2.0 * 3.14159265 * float(i) / 5.0;
        float nextVertexAngle = 2.0 * 3.14159265 * float(i + 1) / 5.0;

        if (angle > vertexAngle && angle < nextVertexAngle)
        {
            // Simplified logic to check if inside the arm
            inside = radius < size * (1.0 - abs(sin(angle - vertexAngle)));
            break;
        }
    }

    // Define color based on the flower logic
    vec3 color = inside ? vec3(1.0, 0.0, 0.0) : vec3(0.0); // Red if inside, black otherwise

    gl_FragColor = vec4(color,1.0);
}
