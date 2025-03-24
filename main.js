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

uniform vec4 iMouse;

// ================================
// FORMAS BÁSICAS
// https://iquilezles.org/articles/distfunctions/
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
// ROTAÇÃO E VIBRAÇÃO DE ÁUDIO
// https://www.youtube.com/watch?v=khblXafu7iA
// ================================

mat2 rot2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

float audioDisplacement(float baseValue) {
    return baseValue + (sin(iTime * 5.0) * iAudio * 0.05);
}

// ================================
// CENA
// ================================

vec2 map(vec3 p) {
    p.xz *= rot2D(iTime);

    vec3 spherePos[6];
    spherePos[0] = vec3(sin(iAudio * 8.0), 0.0, 0.0);
    spherePos[1] = vec3(0.0, sin(iAudio * 8.0), 0.0);
    spherePos[2] = vec3(0.0, -sin(iAudio * 8.0), 0.0);
    spherePos[3] = vec3(-sin(iAudio * 8.0), 0.0, 0.0);
    spherePos[4] = vec3(0.0, 0.0, sin(iAudio * 8.0));
    spherePos[5] = vec3(0.0, 0.0, -sin(iAudio * 8.0));

    float minDist = 1e3;
    float objIndex = -1.0;

    // Calcula distância para as esferas
    for (int i = 0; i < 6; i++) {
        float dist = sdSphere(p - spherePos[i], audioDisplacement(0.3));
        if (dist < minDist) {
            minDist = dist;
            objIndex = float(i);
        }
    }

    float boxFrame = sdBoxFrame(p, vec3(0.4), 0.03);
    if (boxFrame < minDist) {
        minDist = boxFrame;
        objIndex = 6.0;
    }

    return vec2(minDist, objIndex);
}

// ================================
// SOMBRAS MELHORADAS PARA TODOS OS OBJETOS
// ================================

float softShadow(vec3 ro, vec3 rd, float k) {
    float res = 1.0;
    float t = 0.1;

    for (int i = 0; i < 40; i++) {
        float d = map(ro + rd * t).x;
        if (d < 0.001) return 0.0;
        res = min(res, k * d / t);
        t += d;
    }

    return res;
}

// ================================
// ILUMINAÇÃO DIFUSA + REFLEXO INTERNO DO BOXFRAME
// ================================

vec3 calculateLighting(vec3 p, vec3 normal, vec3 lightPos, bool isBox) {
    vec3 lightDir = normalize(lightPos - p);

    // Difusa
    float diff = max(dot(normal, lightDir), 0.0);

    // Reflexo especular
    vec3 viewDir = normalize(-p);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

    vec3 lightColor = isBox ? vec3(0.6, 0.8, 1.0) : vec3(1.0, 0.9, 0.8);

    // Combina difusa e especular
    return vec3(0.1) + diff * lightColor + spec * vec3(1.0);
}

// ================================
// NORMAL AJUSTADA PRO BOXFRAME
// ================================

vec3 calculateNormal(vec3 p) {
    vec2 a = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + a.xyy).x - map(p - a.xyy).x,
        map(p + a.yxy).x - map(p - a.yxy).x,
        map(p + a.yyx).x - map(p - a.yyx).x
    ));
}

// ================================
// RENDERIZAÇÃO FINAL
// ================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord * 2.0 - iResolution) / iResolution.y;
    vec2 mouse = vec2(iMouse.x, iMouse.y);

    vec3 ro = vec3(0.0, 0.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.0));
    vec3 col = vec3(0.0);

    float t = 0.0;
    vec2 res;

    // Rotação com o mouse
    ro.yz *= rot2D(-mouse.y);
    rd.yz *= rot2D(-mouse.y);
    ro.xz *= rot2D(-mouse.x);
    rd.xz *= rot2D(-mouse.x);

    // Raymarching
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        res = map(p);

        t += res.x;

        if (res.x < 0.001) break;
        if (t > 100.0) break;
    }

    if (t < 100.0) {
        vec3 p = ro + rd * t;
        vec3 normal = calculateNormal(p);
        vec3 lightPos = vec3(2.0, 3.0, -2.0);

        float shadow = softShadow(p, normalize(lightPos - p), 64.0);

        // Se for BoxFrame, usa iluminação interna personalizada
        bool isBox = (res.y == 6.0);
        col = calculateLighting(p, normal, lightPos, isBox);

        col *= shadow;
    } else {
        col = vec3(0.1 + iAudio * 0.1, 0.0, 0.1 - iAudio * 0.1);
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

const resolutionLocation = gl.getUniformLocation(program, "iResolution");
const timeLocation = gl.getUniformLocation(program, "iTime");
const audioLocation = gl.getUniformLocation(program, "iAudio");


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

let mouseX = 0;
let mouseY = 0;
let isDragging = false;

canvas.addEventListener("mousedown", () => (isDragging = true));
canvas.addEventListener("mouseup", () => (isDragging = false));

canvas.addEventListener("mousemove", (event) => {
    if (isDragging) {
        mouseX += event.movementX * 0.01;
        mouseY += event.movementY * 0.01;
    }
});

const mouseLocation = gl.getUniformLocation(program, "iMouse");

function render(time) {
    time *= 0.001;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(program);

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time);

    gl.uniform4f(mouseLocation, mouseX, mouseY, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}
requestAnimationFrame(render);
