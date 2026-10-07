// Fokus-Peaking und Zebra (YZ-16): Ein WebGL-Shader legt über das Live-Bild farbige Punkte an scharfen
// Kanten (gemessen in echten Kamerapixeln) und Streifen über fast weiße Stellen. Nur Ansicht – Fotos und
// Videos bleiben unverändert.
const peaking = {
    peaking: speicher.lesen('peaking', false),
    zebra: speicher.lesen('zebra', false),
    gl: null,
    prog: null,
    tex: null,
    orte: {},
    neuesBild: false,

    init() {
        $('#peaking-knopf').addEventListener('click', () => this.umschalten('peaking'));
        $('#zebra-knopf').addEventListener('click', () => this.umschalten('zebra'));
        for (const id of ['peaking-schwelle', 'peaking-farbe', 'zebra-ab']) {
            const el = $('#' + id);
            el.value = speicher.lesen(id, el.value);
            el.addEventListener('input', () => { speicher.schreiben(id, el.value); this.zeichnen(); });
        }
        // Jedes neue Kamerabild hochladen und zeichnen
        const v = ansicht.video;
        const bild = () => {
            this.neuesBild = true;
            if (this.peaking || this.zebra) this.zeichnen();
            v.requestVideoFrameCallback(bild);
        };
        v.requestVideoFrameCallback(bild);
        // Zebra-Streifen laufen, auch bei Standbild
        setInterval(() => { if (this.zebra && ansicht.standbild) this.zeichnen(); }, 100);
        this.knoepfe();
    },

    umschalten(was) {
        this[was] = !this[was];
        speicher.schreiben(was, this[was]);
        this.knoepfe();
        this.neuesBild = true;
        this.zeichnen();
    },

    knoepfe() {
        $('#peaking-knopf').classList.toggle('an', this.peaking);
        $('#zebra-knopf').classList.toggle('an', this.zebra);
        $('#peaking').hidden = !(this.peaking || this.zebra);
    },

    einrichten() {
        const c = $('#peaking');
        const gl = c.getContext('webgl2', { premultipliedAlpha: false, alpha: true, antialias: false, preserveDrawingBuffer: true });
        if (!gl) throw new Error('kein WebGL2');
        const shader = (art, text) => {
            const s = gl.createShader(art);
            gl.shaderSource(s, text);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        };
        const ecken = `#version 300 es
            in vec2 lage;
            void main() { gl_Position = vec4(lage, 0.0, 1.0); }`;
        const farben = `#version 300 es
            precision highp float;
            uniform sampler2D bild;
            uniform vec2 texel;        // 1 / Videogröße
            uniform vec4 rahmen;       // Bild in Gerätepixeln: links, oben, Breite, Höhe
            uniform vec2 flaeche;      // Leinwandgröße in Gerätepixeln
            uniform vec2 spiegel;
            uniform float schwelle;
            uniform vec3 farbe;
            uniform float zebraAb;
            uniform float zeit;
            uniform int mitPeaking;
            uniform int mitZebra;
            out vec4 aus;
            float hell(vec2 uv) { return dot(texture(bild, uv).rgb, vec3(0.2126, 0.7152, 0.0722)); }
            void main() {
                vec2 p = vec2(gl_FragCoord.x, flaeche.y - gl_FragCoord.y);
                vec2 uv = (p - rahmen.xy) / rahmen.zw;
                aus = vec4(0.0);
                if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return;
                if (spiegel.x > 0.5) uv.x = 1.0 - uv.x;
                if (spiegel.y > 0.5) uv.y = 1.0 - uv.y;
                if (mitZebra == 1 && hell(uv) >= zebraAb) {
                    float s = mod(p.x + p.y + zeit * 40.0, 16.0);
                    if (s < 7.0) aus = vec4(1.0, 1.0, 1.0, 0.85); else aus = vec4(0.0, 0.0, 0.0, 0.55);
                }
                if (mitPeaking == 1) {
                    // Sobel in echten Kamerapixeln
                    float a = hell(uv + texel * vec2(-1.0, -1.0)), b = hell(uv + texel * vec2(0.0, -1.0)), c = hell(uv + texel * vec2(1.0, -1.0));
                    float d = hell(uv + texel * vec2(-1.0, 0.0)), f = hell(uv + texel * vec2(1.0, 0.0));
                    float g = hell(uv + texel * vec2(-1.0, 1.0)), h = hell(uv + texel * vec2(0.0, 1.0)), i = hell(uv + texel * vec2(1.0, 1.0));
                    float gx = (c + 2.0 * f + i) - (a + 2.0 * d + g);
                    float gy = (g + 2.0 * h + i) - (a + 2.0 * b + c);
                    if (length(vec2(gx, gy)) > schwelle) aus = vec4(farbe, 1.0);
                }
            }`;
        const prog = gl.createProgram();
        gl.attachShader(prog, shader(gl.VERTEX_SHADER, ecken));
        gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, farben));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        const puf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, puf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const lage = gl.getAttribLocation(prog, 'lage');
        gl.enableVertexAttribArray(lage);
        gl.vertexAttribPointer(lage, 2, gl.FLOAT, false, 0, 0);
        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        for (const n of ['bild', 'texel', 'rahmen', 'flaeche', 'spiegel', 'schwelle', 'farbe', 'zebraAb', 'zeit', 'mitPeaking', 'mitZebra']) {
            this.orte[n] = gl.getUniformLocation(prog, n);
        }
        this.gl = gl;
        this.prog = prog;
    },

    zeichnen() {
        if (!(this.peaking || this.zebra)) return;
        const v = ansicht.video;
        if (!v.videoWidth) return;
        try {
            if (!this.gl) this.einrichten();
        } catch (e) {
            console.warn('Peaking', e);
            toast('Peaking und Zebra brauchen WebGL2 – hier nicht verfügbar.', true);
            this.peaking = this.zebra = false;
            this.knoepfe();
            return;
        }
        const gl = this.gl, c = gl.canvas, o = this.orte;
        const dpr = devicePixelRatio || 1;
        const W = Math.round(ansicht.buehne.clientWidth * dpr), H = Math.round(ansicht.buehne.clientHeight * dpr);
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        gl.viewport(0, 0, W, H);
        if (this.neuesBild) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
            this.neuesBild = false;
        }
        const farbe = $('#peaking-farbe').value;
        const rgb = [1, 3, 5].map((i) => parseInt(farbe.slice(i, i + 2), 16) / 255);
        // Empfindlichkeit 1…100 -> Kantenstärke 1,2 … 0,08
        const e = Number($('#peaking-schwelle').value) || 50;
        gl.uniform1i(o.bild, 0);
        gl.uniform2f(o.texel, 1 / v.videoWidth, 1 / v.videoHeight);
        gl.uniform4f(o.rahmen, ansicht.ox * dpr, ansicht.oy * dpr, ansicht.fit.w * ansicht.zoom * dpr, ansicht.fit.h * ansicht.zoom * dpr);
        gl.uniform2f(o.flaeche, W, H);
        gl.uniform2f(o.spiegel, ansicht.spiegelnH ? 1 : 0, ansicht.spiegelnV ? 1 : 0);
        gl.uniform1f(o.schwelle, 1.2 * 0.067 ** ((e - 1) / 99));
        gl.uniform3f(o.farbe, ...rgb);
        gl.uniform1f(o.zebraAb, Number($('#zebra-ab').value) || 0.95);
        gl.uniform1f(o.zeit, (performance.now() / 1000) % 1000);
        gl.uniform1i(o.mitPeaking, this.peaking ? 1 : 0);
        gl.uniform1i(o.mitZebra, this.zebra ? 1 : 0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    // Selbsttest: wie viele Punkte sind gerade markiert?
    markiert() {
        if (!this.gl) return 0;
        const gl = this.gl;
        const px = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
        gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let n = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++;
        return n;
    },
};
