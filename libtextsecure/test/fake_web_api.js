window.setImmediate = window.nodeSetImmediate;

const fakeCall = () => Promise.resolve();

const fakeAPI = {
  getAttachment: fakeCall,
  putAttachment: fakeCall,
  putAvatar: fakeCall,
};

window.WebAPI = {
  connect: () => fakeAPI,
};
