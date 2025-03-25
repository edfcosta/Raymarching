const canvas = document.getElementById('webglCanvas');
const gl = canvas.getContext('webgl');

// Ajusta o canvas pro tamanho da tela
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Vertex Shader básico (posição do canvas)
const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform float iAudio;

// ================================
// FORMAS BÁSICAS
// ================================

float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBoxFrame(vec3 p, vec3 b, float e) {
    p = abs(p) - b;
    vec3 q = abs(p + e) - e;

    return min(
        min(
            length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
            length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)
        ),
        length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0)
    );
}

// ================================
// ROTAÇÃO
// https://www.youtube.com/watch?v=khblXafu7iA
// ================================

mat2 rot2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}


float audio(float baseValue) {
    return baseValue + (iAudio * 1.5);
}

// ================================
// CENA
// ================================

vec2 map(vec3 p) {
    p.yz *= rot2D(iTime*0.5);
    p.xz *= rot2D(iTime*0.5);

    vec3 spherePos[6];
    spherePos[0] = vec3(sin(iAudio * 10.0), 0.0, 0.0);
    spherePos[1] = vec3(0.0, sin(iAudio * 10.0), 0.0);
    spherePos[2] = vec3(0.0, -sin(iAudio * 10.0), 0.0);
    spherePos[3] = vec3(-sin(iAudio * 10.0), 0.0, 0.0);
    spherePos[4] = vec3(0.0, 0.0, sin(iAudio * 10.0));
    spherePos[5] = vec3(0.0, 0.0, -sin(iAudio * 10.0));

    float minDist = 1e3;
    float objIndex = -1.0;

    // Dist spheres
    for (int i = 0; i < 6; i++) {
        float dist = sdSphere(p - spherePos[i], audio(0.05));
        if (dist < minDist) {
            minDist = dist;
            objIndex = float(i);
        }
    }
    // Dist box frame
    float boxFrame = sdBoxFrame(p, vec3(0.6), 0.03);
    if (boxFrame < minDist) {
        minDist = boxFrame;
        objIndex = 7.0;
    }

    return vec2(minDist, objIndex);
}

// ================================
// Raymarching adaptado de:
// https://www.youtube.com/watch?v=khblXafu7iA
// ================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.0));
    vec3 col = vec3(0.0);

    float t = 0.0;
    vec2 res;

    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        res = map(p);

        t += res.x;

        if (res.x < 0.001) break;
        if (t > 100.0) break;
    }

// ================================
// ILUMINAÇÃO DE PHONG Adaptado de:
// https://www.shadertoy.com/view/XlXGDj
// ================================

// Se bateu em algo
if (t < 100.0) {
    vec3 p = ro + rd * t;
    
    // Cálculo da normal usando diferença de mapa (SDF)
    vec2 e = vec2(0.001, 0.0);

    vec3 normal = normalize(vec3(
        map(p + e.xyy).x - map(p - e.xyy).x,
        map(p + e.yxy).x - map(p - e.yxy).x,
        map(p + e.yyx).x - map(p - e.yyx).x
    ));

    vec3 lightDir = normalize(vec3(-1.0, 1.0, -1.0));
    vec3 viewDir = normalize(rd); 
    
    // Oclusão ambiente
    float occ = 0.4;

    // ambiente 
    float amb = 0.4;

    // difusa
    float dif = dot(lightDir, normal);

    // especular
    vec3 h = normalize(viewDir + lightDir);
    float spe = pow(clamp(dot(h, normal), 0.0, 1.0), 64.0);

    // Cores básicas para iluminação
    vec3 ambientColor = vec3(10.0, 1.0, 25.0);
    vec3 diffuseColor = vec3(10.0, 1.0, 25.0);
    vec3 specularColor = vec3(1.0);

    col = amb * ambientColor * occ;
    col += dif * diffuseColor * occ;
    col += spe * specularColor * occ;

}
// Fundo 
else {
    col = vec3(0.1 + iAudio * 0.8, 0.0 + iAudio * 0.2, 0.1 + iAudio * 0.4);
}

fragColor = vec4(col, 1.0);
}
// ================================
// EXECUTA O SHADER
// ================================

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}

`;

// Criação dos shaders
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile failed:', gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

// Monta o programa WebGL
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link failed:', gl.getProgramInfoLog(program));
}

// Define o canvas
const vertices = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1
]);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);


// Variáveis dentro do fragmentShader
const resolutionLocation = gl.getUniformLocation(program, "iResolution");
const timeLocation = gl.getUniformLocation(program, "iTime");
const audioLocation = gl.getUniformLocation(program, "iAudio");

//========================
// HOWLER.JS
// https://github.com/goldfire/howler.js#documentation
// =======================
const sound = new Howl({
    src: ['music.mp3'],
    autoplay: true,
    loop: true,
    volume: 0.5
});

const audioContext = Howler.ctx;
const analyser = audioContext.createAnalyser();
Howler.masterGain.connect(analyser);

analyser.fftSize = 256;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

function updateAudioData() {
    analyser.getByteFrequencyData(dataArray);
    const audioEnergy = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
    gl.uniform1f(audioLocation, audioEnergy / 255.0);
    requestAnimationFrame(updateAudioData);
}
updateAudioData();

function render(time) {
    time *= 0.001;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(program);

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time);


    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}
requestAnimationFrame(render);
