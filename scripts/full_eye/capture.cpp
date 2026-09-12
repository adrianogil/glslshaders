// Offline macOS OpenGL teacher capture. Not part of the deployed neural shader.
#define GL_SILENCE_DEPRECATION
#include <OpenGL/OpenGL.h>
#include <OpenGL/gl3.h>
#include <cmath>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <vector>

std::string read(const char* path) {
    std::ifstream f(path); if (!f) throw std::runtime_error(path);
    std::stringstream s; s << f.rdbuf(); return s.str();
}
GLuint shader(GLenum type, const std::string& source) {
    GLuint s = glCreateShader(type); const char* p = source.c_str();
    glShaderSource(s, 1, &p, nullptr); glCompileShader(s);
    GLint ok; glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) { char log[16384]; glGetShaderInfoLog(s, sizeof(log), nullptr, log); throw std::runtime_error(log); }
    return s;
}
GLuint program(const std::string& source) {
    const std::string vertex = "#version 330 core\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}";
    GLuint v=shader(GL_VERTEX_SHADER,vertex), f=shader(GL_FRAGMENT_SHADER,source), p=glCreateProgram();
    glAttachShader(p,v); glAttachShader(p,f); glLinkProgram(p); glDeleteShader(v); glDeleteShader(f);
    GLint ok; glGetProgramiv(p,GL_LINK_STATUS,&ok);
    if(!ok){char log[16384];glGetProgramInfoLog(p,sizeof(log),nullptr,log);throw std::runtime_error(log);}
    return p;
}
struct Target { GLuint texture, fbo; int w,h; };
Target target(int w,int h) {
    Target t; t.w=w;t.h=h;glGenTextures(1,&t.texture);glBindTexture(GL_TEXTURE_2D,t.texture);
    glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA32F,w,h,0,GL_RGBA,GL_FLOAT,nullptr);
    glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
    glGenFramebuffers(1,&t.fbo);glBindFramebuffer(GL_FRAMEBUFFER,t.fbo);
    glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,t.texture,0);
    if(glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)throw std::runtime_error("float framebuffer incomplete");
    return t;
}
int main(int argc,char** argv) { try {
    if(argc!=7)throw std::runtime_error("capture material.glsl teacher.glsl states.f32 output.f32 width height");
    CGLPixelFormatAttribute attrs[]={kCGLPFAOpenGLProfile,(CGLPixelFormatAttribute)kCGLOGLPVersion_3_2_Core,kCGLPFAAccelerated,(CGLPixelFormatAttribute)0};
    CGLPixelFormatObj format; GLint count; CGLError e=CGLChoosePixelFormat(attrs,&format,&count);
    if(e!=kCGLNoError||!format)throw std::runtime_error("CGL pixel format unavailable");
    CGLContextObj context; e=CGLCreateContext(format,nullptr,&context);CGLDestroyPixelFormat(format);
    if(e!=kCGLNoError)throw std::runtime_error("CGL context unavailable"); CGLSetCurrentContext(context);
    std::cout<<"GPU: "<<glGetString(GL_RENDERER)<<std::endl;
    GLuint vao;glGenVertexArrays(1,&vao);glBindVertexArray(vao);glDisable(GL_DITHER);
    GLuint material=program(read(argv[1])),eye=program(read(argv[2]));
    int w=std::stoi(argv[5]),h=std::stoi(argv[6]);Target atlas=target(512,257),output=target(w,h);
    std::ifstream states(argv[3],std::ios::binary);std::ofstream out(argv[4],std::ios::binary);
    if(!states||!out)throw std::runtime_error("Unable to open input/output");
    float controls[4];std::vector<float> pixels(w*h*4);int n=0;
    while(states.read(reinterpret_cast<char*>(controls),sizeof(controls))) {
        glUseProgram(material);glBindFramebuffer(GL_FRAMEBUFFER,atlas.fbo);glViewport(0,0,atlas.w,atlas.h);
        glUniform1f(glGetUniformLocation(material,"captureHue"),controls[2]);
        glDrawArrays(GL_TRIANGLES,0,3);
        glUseProgram(eye);glBindFramebuffer(GL_FRAMEBUFFER,output.fbo);glViewport(0,0,w,h);
        glActiveTexture(GL_TEXTURE0);glBindTexture(GL_TEXTURE_2D,atlas.texture);
        glUniform1i(glGetUniformLocation(eye,"iChannel0"),0);
        glUniform3f(glGetUniformLocation(eye,"iResolution"),w,h,1);
        glUniform4fv(glGetUniformLocation(eye,"captureControls"),1,controls);
        glDrawArrays(GL_TRIANGLES,0,3);
        glReadPixels(0,0,w,h,GL_RGBA,GL_FLOAT,pixels.data());
        GLenum error=glGetError();if(error!=GL_NO_ERROR)throw std::runtime_error("OpenGL error "+std::to_string(error));
        out.write(reinterpret_cast<char*>(pixels.data()),pixels.size()*sizeof(float));
        if(++n%32==0)std::cout<<"Captured "<<n<<" states"<<std::endl;
    }
    if(!out)throw std::runtime_error("Output write failed");
    std::cout<<"Finished "<<n<<" states "<<w<<"x"<<h<<std::endl;
    CGLSetCurrentContext(nullptr);CGLDestroyContext(context);return 0;
} catch(const std::exception& e){std::cerr<<e.what()<<std::endl;return 1;} }
