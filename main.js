import { mat4, glMatrix, vec3 } from "gl-matrix";
import { GLSL } from './src/glsl'
import background from "./src/assets/background.jpg";
import earth from "./src/assets/earth.jpg";
import sun from "./src/assets/sun.jpg";

let canvas, gl;

// 预加载WebGL
window.addEventListener("load", () => {
  canvas = document.getElementById("canvas");
  gl = canvas.getContext("webgl2");

  if (!gl) {
    alert("浏览器不支持webgl，请更换浏览器");
  }
  render(gl);
});

const EARTH_INIT_ANGLE = Math.random() * Math.PI * 2;

// 背景顶点坐标
const backVertices = [
  -1, 1, 0,
  -1, -1, 0,
  1 , 1, 0,
  -1, -1, 0,
  1, 1, 0,
  1, -1, 0,
];

// 背景纹理坐标
const backTexCoords = [
  0, 1,
  0, 0,
  1, 1,
  0, 0,
  1, 1,
  1, 0
];

/**
 *
 * @param {WebGL2RenderingContext} gl
 * @param {string} vertex
 * @param {string} fragment
 */
function Shader(gl, vertex, fragment) {
  const createShader = (gl, shaderType, shaderSource) => {
    // shader 初始化
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    // 检查glsl语法是否正确
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw "无法编译Shader，请检查语法是否正确";
    }

    return shader;
  };

  // 将顶点着色器和片段着色器整合，生成新的着色器程序
  const createProgram = (gl, vertex, fragment) => {
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw "无法编译，请检查Shader";
    }
    // 节省内存，只需要program即可
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return program;
  };

  const obj = {};
  obj.gl = gl;
  obj.program = createProgram(
    gl,
    createShader(gl, gl.VERTEX_SHADER, vertex),
    createShader(gl, gl.FRAGMENT_SHADER, fragment)
  );
  // 箭头函数别用this
  obj.useProgram = () => {
    obj.gl.useProgram(obj.program);
  };
  obj.setMat4 = (name, m4) => {
    const value = new Float32Array(m4);
    const location = obj.gl.getUniformLocation(obj.program, name);
    obj.gl.uniformMatrix4fv(location, false, value);
  };

  obj.setFloat3 = (name, x, y, z) => {
    const location = obj.gl.getUniformLocation(obj.program, name);
    obj.gl.uniform3f(location, x, y, z);
  };

  return obj;
}

/**
 *
 * @param {WebGL2RenderingContext} gl
 */
const render = (gl) => {
  gl.enable(gl.DEPTH_TEST);
  // 背景
  const backShader = Shader(gl, GLSL.vertex_background, GLSL.fragment_background);
  // 太阳
  const sunShader = Shader(gl, GLSL.vertex_sun, GLSL.fragment_sun);
  // 行星
  const earthShader = Shader(gl, GLSL.vertex_earth, GLSL.fragment_earth);
  // vao创建
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  // 背景的顶点坐标状态设置
  const backVbo = gl.createBuffer();
  const backPos = gl.getAttribLocation(backShader.program, "aPos"); // 获得glsl代码中的aPos变量的值
  gl.bindBuffer(gl.ARRAY_BUFFER, backVbo); // 绑定缓冲区
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(backVertices),
    gl.STATIC_DRAW
  ); // 传输顶点数据给buffer
  gl.enableVertexAttribArray(backPos); // 激活属性
  gl.vertexAttribPointer(backPos, 3, gl.FLOAT, false, 0, 0);

  // 背景的纹理坐标设置
  const backTextureVbo = gl.createBuffer();
  const backTexturePos = gl.getAttribLocation(backShader.program, "aTexCoord");
  gl.bindBuffer(gl.ARRAY_BUFFER, backTextureVbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(backTexCoords),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(backTexturePos);
  gl.vertexAttribPointer(backTexturePos, 2, gl.FLOAT, false, 0, 0);

  // 背景纹理对象设置
  const backTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, backTexture);
  // 定义一系列纹理渲染规则 -> 设置纹理参数
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // 水平填充 -> 直接拉伸（不重复）
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // 竖直填充
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); // gl.NEAREST -> 纹理缩放时，取接近的那个像素
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // 创建图形对象
  const back_img = document.createElement("img");
  back_img.crossOrigin = "anonymous";
  back_img.src = background;
  // 保证图片加载后再进行渲染，否则无法加载纹理图片
  back_img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, backTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, back_img);
  };

  // 太阳
  const sunVao = gl.createVertexArray();
  gl.bindVertexArray(sunVao);
  // 顶点坐标设置
  const sunCoorVbo = gl.createBuffer();
  // 获取太阳的坐标
  const {
    vertices: sunVert,
    normals: sunNorm,
    texture: sunTextCoor,
  } = computedPositions(100, 20);
  const sunPos = gl.getAttribLocation(sunShader.program, "aPos");
  gl.bindBuffer(gl.ARRAY_BUFFER, sunCoorVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sunVert), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(sunPos);
  gl.vertexAttribPointer(sunPos, 3, gl.FLOAT, false, 0, 0);

  // 纹理坐标
  const sunTexVbo = gl.createBuffer();
  const sunTexPos = gl.getAttribLocation(sunShader.program, "aTexCoord");
  gl.bindBuffer(gl.ARRAY_BUFFER, sunTexVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sunTextCoor), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(sunTexPos);
  gl.vertexAttribPointer(sunTexPos, 2, gl.FLOAT, false, 0, 0);

  // 纹理设置
  const sunTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sunTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const sunImg = document.createElement("img");
  sunImg.crossOrigin = "anonymous";
  sunImg.src = sun;
  sunImg.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, sunTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sunImg);
  };

  // 地球
  const earthVao = gl.createVertexArray();
  gl.bindVertexArray(earthVao);

  const {
    vertices: earthVertices,
    normals: earthNormals,
    texture: earthTexCoords,
  } = computedPositions(100, 10);

  const earthVbo = gl.createBuffer();
  const earthPos = gl.getAttribLocation(earthShader.program, "aPos");
  gl.bindBuffer(gl.ARRAY_BUFFER, earthVbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(earthVertices),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(earthPos);
  gl.vertexAttribPointer(earthPos, 3, gl.FLOAT, false, 0, 0);

  const earthNormalVbo = gl.createBuffer();
  const earthNormalPos = gl.getAttribLocation(earthShader.program, "aNorm");
  gl.bindBuffer(gl.ARRAY_BUFFER, earthNormalVbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(earthNormals),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(earthNormalPos);
  gl.vertexAttribPointer(earthNormalPos, 3, gl.FLOAT, false, 0, 0);

  const earthTexVbo = gl.createBuffer();
  const earthTexLocation = gl.getAttribLocation(
    earthShader.program,
    "aTexCoord"
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, earthTexVbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(earthTexCoords),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(earthTexLocation);
  gl.vertexAttribPointer(earthTexLocation, 2, gl.FLOAT, false, 0, 0);

  // 纹理
  const earthTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, earthTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const earthImg = document.createElement("img");
  earthImg.crossOrigin = "anonymous";
  earthImg.src = earth;
  earthImg.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, earthImg);
  };

  // 为了设置动画效果，设置渲染回调函数，requestAnimationFrame
  const draw = (time) => {
    // 初始化canvas的宽高，防止模型模糊
    const canvas = gl.canvas;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (canvas.width != displayWidth || canvas.height != displayHeight) {
      canvas.height = displayHeight;
      canvas.width = displayWidth;
    }
    // 视框设置
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const projection = mat4.perspective(
      mat4.create(),
      glMatrix.toRadian(45),
      gl.canvas.width / gl.canvas.height,
      0.1,
      1000
    );
    // console.log('cameraX', cameraX, 'cameraY', cameraY)
    // 相机位设置
    const view = mat4.lookAt(mat4.create(), [10, -90, 90], [0, 0, 0], [0, 1, 0]);

    // ---背景
    backShader.useProgram();
    gl.bindVertexArray(vao);
    gl.bindTexture(gl.TEXTURE_2D, backTexture);
    gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST);

    // ---太阳
    sunShader.useProgram();
    gl.bindVertexArray(sunVao);
    sunShader.setMat4("projection", projection);
    sunShader.setMat4(
      "model",
      mat4.rotateZ(mat4.create(), mat4.create(), time * 0.001 * 0.2)
    );
    sunShader.setMat4("view", view);
    gl.bindTexture(gl.TEXTURE_2D, sunTexture);
    gl.drawArrays(gl.TRIANGLES, 0, sunVert.length / 3);

    // ---地球
    earthShader.useProgram();
    earthShader.setMat4("projection", projection);
    earthShader.setFloat3("sunLightColor", 1, 1, 1);
    earthShader.setFloat3("sunPos", 0, 0, 0);
    earthShader.setMat4("view", view);
    gl.bindVertexArray(earthVao);

    const model = mat4.create();
    mat4.rotateZ(model, model, time * 0.0001 * 3);
    mat4.rotateZ(model, model, EARTH_INIT_ANGLE);
    mat4.translate(model, model, [42, 0, 0]);
    mat4.rotateZ(model, model, time * 0.001 * 0.2);

    earthShader.setMat4("model", model);
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    gl.drawArrays(gl.TRIANGLES, 0, sunVert.length / 3);

    requestAnimationFrame(draw);
  };

  requestAnimationFrame(draw);
};

// split为分割条数，radius为球体半径
const computedPositions = (split, radius) => {
  const vertices = [],
    normals = [],
    texture = []; // 顶点坐标，法向量，纹理坐标
  // 上一个分割线上的顶点坐标缓存，用于求三角形面片所用
  let cache_points = [];
  // 初始化，上轮顶点都是星球的北极点
  for (let i = 0; i < split; i++) {
    cache_points.push([0, radius, 0]);
  }

  const tex_x = 1 / split,
    tex_y = 1 / split;
  for (let latitude = 0; latitude < split - 1; latitude++) {
    const angle = Math.PI * ((latitude + 1) / split);
    const y = Math.cos(angle) * radius; // 坐标y
    const xz = Math.sin(angle) * radius; // xz平面投影线长度
    const current = []; // 本轮计算顶点坐标缓存

    // 计算坐标x，z
    for (let longitude = 0; longitude < split; longitude++) {
      const angle = 2 * Math.PI * (longitude / split);
      const x = xz * Math.cos(angle);
      const z = xz * Math.sin(angle);
      current.push([x, y, z]); // 坐标存储
    }

    // 为了和顶点坐标对应，纹理坐标也需要在每个轮次计算时形成一个三角形面片
    // 这里设计的三角形面片顶点顺序为逆时针，且从左上角顶点开始计算
    const texture_Y1 = 1 - latitude * tex_y;
    const texture_Y2 = 1 - (latitude + 1) * tex_y;
    // 绘制平面, 因为一个计算轮次里有四个点，四个点最少也需要两个三角形，所以计算两个三角形
    for (let i = 0; i < split - 1; i++) {
      // 注意：点的顺序一定要按照逆时针方向，右手定则保证法向量指向球外
      // 三角形1
      vertices.push(...cache_points[i]);
      vertices.push(...current[i]);
      vertices.push(...cache_points[i + 1]);
      // 三角形2
      vertices.push(...current[i]);
      vertices.push(...current[i + 1]);
      vertices.push(...cache_points[i + 1]);
      // 纹理坐标计算
      const texture_X1 = tex_x * i;
      const texture_X2 = tex_x * (i + 1);
      // 纹理映射 要和上述的顶点坐标一一对应
      texture.push(texture_X1, texture_Y1);
      texture.push(texture_X1, texture_Y2);
      texture.push(texture_X2, texture_Y1);

      texture.push(texture_X1, texture_Y2);
      texture.push(texture_X2, texture_Y2);
      texture.push(texture_X2, texture_Y1);
    }

    vertices.push(...cache_points[split - 1]);
    vertices.push(...current[split - 1]);
    vertices.push(...cache_points[0]);

    vertices.push(...current[split - 1]);
    vertices.push(...current[0]);
    vertices.push(...cache_points[0]);

    const texX1 = 1 - tex_x;
    const texX2 = 1;
    texture.push(texX1, texture_Y1);
    texture.push(texX1, texture_Y2);
    texture.push(texX2, texture_Y2);
    texture.push(texX1, texture_Y1);
    texture.push(texX2, texture_Y1);
    texture.push(texX2, texture_Y2);

    //  做缓存
    cache_points = current;
  }

  // 纬度方向，最后一圈在上述循环中没有计算，所以要再计算一次
  const texY1 = tex_y;
  const texY2 = 0;
  for (let i = 0; i < split - 1; i++) {
    vertices.push(...cache_points[i]);
    vertices.push(0, -radius, 0);
    vertices.push(...cache_points[i + 1]);

    vertices.push(0, -radius, 0);
    vertices.push(...cache_points[i + 1]);
    vertices.push(0, -radius, 0);

    // 纹理坐标
    const texX1 = tex_x * i;
    const texX2 = tex_x * (i + 1);

    texture.push(texX1, texY1);
    texture.push(texX1, texY2);
    texture.push(texX2, texY2);
    texture.push(texX1, texY1);
    texture.push(texX2, texY2);
    texture.push(texX2, texY1);
  }
  // 最后一个面
  vertices.push(
    cache_points[split - 1][0],
    cache_points[split - 1][1],
    cache_points[split - 1][2]
  );
  vertices.push(0, -radius, 0);
  vertices.push(cache_points[0][0], cache_points[0][1], cache_points[0][2]);

  vertices.push(0, -radius, 0);
  vertices.push(cache_points[0][0], cache_points[0][1], cache_points[0][2]);
  vertices.push(0, -radius, 0);

  // 对应纹理坐标存储
  const texX1 = 1 - tex_x;
  const texX2 = 1;
  texture.push(texX1, texY1);
  texture.push(texX1, texY2);
  texture.push(texX2, texY2);
  texture.push(texX1, texY2);
  texture.push(texX2, texY2);
  texture.push(texX2, texY1);

  // 法向量计算 一组点有六个（两个平面），所以是 i += 3 * 6
  for (let i = 0; i < vertices.length; i += 18) {
    // 逆时针方向的向量，保证它们的叉乘结果（法向量）指向球外
    const vector1 = [
      vertices[i + 3] - vertices[i],
      vertices[i + 4] - vertices[i + 1],
      vertices[i + 5] - vertices[i + 2],
    ];
    const vector2 = [
      vertices[i + 6] - vertices[i + 3],
      vertices[i + 7] - vertices[i + 4],
      vertices[i + 8] - vertices[i + 5],
    ];
    // 求叉积
    const normal1 = vec3.cross(vec3.create(), vector1, vector2);
    vec3.normalize(normal1, normal1);
    normals.push(...normal1, ...normal1, ...normal1);

    const vector3 = [
      vertices[i + 12] - vertices[i + 9],
      vertices[i + 13] - vertices[i + 10],
      vertices[i + 14] - vertices[i + 11],
    ];
    const vector4 = [
      vertices[i + 15] - vertices[i + 12],
      vertices[i + 16] - vertices[i + 13],
      vertices[i + 17] - vertices[i + 14],
    ];
    const normal2 = vec3.cross(vec3.create(), vector3, vector4);
    vec3.normalize(normal2, normal2);
    normals.push(...normal2, ...normal2, ...normal2);
  }

  return { vertices, normals, texture };
};
