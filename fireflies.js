//  ________ ___  ________  _______   ________ ___       ___  _______   ________      
// |\  _____\\  \|\   __  \|\  ___ \ |\  _____\\  \     |\  \|\  ___ \ |\   ____\     
// \ \  \__/\ \  \ \  \|\  \ \   __/|\ \  \__/\ \  \    \ \  \ \   __/|\ \  \___|_    
//  \ \   __\\ \  \ \   _  _\ \  \_|/_\ \   __\\ \  \    \ \  \ \  \_|/_\ \_____  \   
//   \ \  \_| \ \  \ \  \\  \\ \  \_|\ \ \  \_| \ \  \____\ \  \ \  \_|\ \|____|\  \  
//    \ \__\   \ \__\ \__\\ _\\ \_______\ \__\   \ \_______\ \__\ \_______\____\_\  \ 
//     \|__|    \|__|\|__|\|__|\|_______|\|__|    \|_______|\|__|\|_______|\_________\
//                                                                        \|_________|

(function() {
  
  // Number of particles
  const numberOfParticles = 100000;
  
  const glsl = x => x;
  const style = document.createElement('style');
  style.id = 'ff-style';
  style.innerHTML = `
    html {
      height: 100vh;
    }
    body {
      margin: 0;
      min-height: 100%;
      background-color: #111122;
      position: relative;
    }
    canvas#ff-canvas {
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      bottom: 0;
    }
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const canvas = document.getElementById('ff-canvas') || document.createElement('canvas');
  if (!canvas.parentElement) {
    canvas.id = 'ff-canvas';
    document.body.insertBefore(canvas, document.body.firstChild);
    canvas.width = window.innerWidth;
    canvas.height = document.body.scrollHeight;
  }
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    console.warn('[fireflies.js] WebGL is not supported.');
    canvas.parentElement.removeChild(canvas);
    return;
  }

  // Vertex shader GLSL source code
  const vsSource = glsl`
    precision mediump float;  
    attribute vec3 aPosition;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uMouse;
    varying vec3 vPosition;

    void main() {
        // vec2 position = aPosition.xy + (uMouse - uResolution / 2.0) / uResolution;
        float phase = aPosition.x + aPosition.y;
        vec2 position = aPosition.xy + vec2(sin(uTime + phase), cos(uTime + phase)) * 0.02;
        // vec2 position = aPosition.xy; // + (uMouse / uResolution * 2.0 - 1.0;
        gl_Position = vec4(position, 0, 1.0);
        gl_PointSize = 2.0 + 1.0 * sin(uTime * 3.0 + phase * 3.0);
        vPosition = aPosition;
    }
  `;

  // Fragment shader GLSL source code
  const fsSource = glsl`
    precision mediump float;
    uniform float uTime;
    varying vec3 vPosition;

    void main() {
        float p = vPosition.x + vPosition.y;
        float phase = (sin(uTime * 3.0 + p * 3.0) + 1.0) / 2.0;
        gl_FragColor = vec4(1.0, 0.6 + phase * 0.3, 0.35, 1.0); // Warm yellow
    }
  `;

  function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Check if shader compilation was successful
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[fireflies.js] An error occurred compiling the shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
  }

  function createShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);

    // Create the shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // Check if shader program linking was successful
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('[fireflies.js] Unable to initialize the shader program:', gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
  }

  // Create the shader program with our vertex and fragment shader sources
  const shaderProgram = createShaderProgram(gl, vsSource, fsSource);
  // Tell WebGL to use our shader program
  gl.useProgram(shaderProgram);

  const uTimeLocation = gl.getUniformLocation(shaderProgram, 'uTime');
  const uMouseLocation = gl.getUniformLocation(shaderProgram, 'uMouse');
  const uResolutionLocation = gl.getUniformLocation(shaderProgram, 'uResolution');


  // Generate random positions for each particle
  const particlesPositions = new Float32Array(numberOfParticles * 2); // *2 for x, y components
  for (let i = 0; i < numberOfParticles; i++) {
      particlesPositions[i * 2] = Math.random() * 2 - 1; // x position, normalized [-1, 1]
      particlesPositions[i * 2 + 1] = Math.random() * 2 - 1; // y position, normalized [-1, 1]
  }

  // Create a buffer for the particles' positions
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Pass the positions data to the buffer
  gl.bufferData(gl.ARRAY_BUFFER, particlesPositions, gl.STATIC_DRAW);

  // Assume 'aPosition' is the attribute in your vertex shader for particle positions
  const aPositionLocation = gl.getAttribLocation(shaderProgram, 'aPosition');

  // Enable the attribute
  gl.enableVertexAttribArray(aPositionLocation);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  const size = 2;          // 2 components per iteration (x, y)
  const type = gl.FLOAT;   // the data is 32bit floats
  const normalize = false; // don't normalize the data
  const stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  const offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(aPositionLocation, size, type, normalize, stride, offset);

  gl.uniform2fv(uResolutionLocation, [canvas.width, canvas.height]);

  // Mouse position
  let mouseX = 0;
  let mouseY = 0;
  window.onmousemove = function(e) {
      mouseX = e.clientX;
      mouseY = canvas.height - e.clientY; // Convert to WebGL coordinates
  };

  // Animation loop
  function animate(time) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Update uniforms in your shader program
    gl.uniform2fv(uMouseLocation, [mouseX, mouseY]);
    gl.uniform1f(uTimeLocation, time * 0.001); // Convert to seconds

    gl.drawArrays(gl.POINTS, 0, numberOfParticles);
    
    requestAnimationFrame(animate);
  }

  animate();

})();
