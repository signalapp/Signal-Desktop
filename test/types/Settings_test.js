var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var import_os = __toESM(require("os"));
var import_sinon = __toESM(require("sinon"));
var import_chai = require("chai");
var Settings = __toESM(require("../../../ts/types/Settings"));
describe("Settings", () => {
  const sandbox = import_sinon.default.createSandbox();
  describe("isAudioNotificationSupported", () => {
    context("on macOS", () => {
      beforeEach(() => {
        sandbox.stub(process, "platform").value("darwin");
      });
      afterEach(() => {
        sandbox.restore();
      });
      it("should return true", () => {
        import_chai.assert.isTrue(Settings.isAudioNotificationSupported());
      });
    });
    context("on Windows", () => {
      context("version 7", () => {
        beforeEach(() => {
          sandbox.stub(process, "platform").value("win32");
          sandbox.stub(import_os.default, "release").returns("7.0.0");
        });
        afterEach(() => {
          sandbox.restore();
        });
        it("should return false", () => {
          import_chai.assert.isFalse(Settings.isAudioNotificationSupported());
        });
      });
      context("version 8+", () => {
        beforeEach(() => {
          sandbox.stub(process, "platform").value("win32");
          sandbox.stub(import_os.default, "release").returns("8.0.0");
        });
        afterEach(() => {
          sandbox.restore();
        });
        it("should return true", () => {
          import_chai.assert.isTrue(Settings.isAudioNotificationSupported());
        });
      });
    });
    context("on Linux", () => {
      beforeEach(() => {
        sandbox.stub(process, "platform").value("linux");
      });
      afterEach(() => {
        sandbox.restore();
      });
      it("should return false", () => {
        import_chai.assert.isFalse(Settings.isAudioNotificationSupported());
      });
    });
  });
  describe("isNotificationGroupingSupported", () => {
    context("on macOS", () => {
      beforeEach(() => {
        sandbox.stub(process, "platform").value("darwin");
      });
      afterEach(() => {
        sandbox.restore();
      });
      it("should return true", () => {
        import_chai.assert.isTrue(Settings.isNotificationGroupingSupported());
      });
    });
    context("on Windows", () => {
      context("version 7", () => {
        beforeEach(() => {
          sandbox.stub(process, "platform").value("win32");
          sandbox.stub(import_os.default, "release").returns("7.0.0");
        });
        afterEach(() => {
          sandbox.restore();
        });
        it("should return false", () => {
          import_chai.assert.isFalse(Settings.isNotificationGroupingSupported());
        });
      });
      context("version 8+", () => {
        beforeEach(() => {
          sandbox.stub(process, "platform").value("win32");
          sandbox.stub(import_os.default, "release").returns("8.0.0");
        });
        afterEach(() => {
          sandbox.restore();
        });
        it("should return true", () => {
          import_chai.assert.isTrue(Settings.isNotificationGroupingSupported());
        });
      });
    });
    context("on Linux", () => {
      beforeEach(() => {
        sandbox.stub(process, "platform").value("linux");
      });
      afterEach(() => {
        sandbox.restore();
      });
      it("should return true", () => {
        import_chai.assert.isTrue(Settings.isNotificationGroupingSupported());
      });
    });
  });
  describe("isHideMenuBarSupported", () => {
    context("on macOS", () => {
      beforeEach(() => {
        sandbox.stub(process, "platform").value("darwin");
      });
      afterEach(() => {
        sandbox.restore();
      });
      it("should return false", () => {
        import_chai.assert.isFalse(Settings.isHideMenuBarSupported());
      });
    });
    context("on Windows", () => {
      context("version 7", () => {
        beforeEach(() => {
          sandbox.stub(process, "platform").value("win32");
          sandbox.stub(import_os.default, "release").returns("7.0.0");
        });
        afterEach(() => {
          sandbox.restore();
        });
        it("should return true", () => {
          import_chai.assert.isTrue(Settings.isHideMenuBarSupported());
        });
      });
      context("version 8+", () => {
        beforeEach(() => {
          sandbox.stub(process, "platform").value("win32");
          sandbox.stub(import_os.default, "release").returns("8.0.0");
        });
        afterEach(() => {
          sandbox.restore();
        });
        it("should return true", () => {
          import_chai.assert.isTrue(Settings.isHideMenuBarSupported());
        });
      });
    });
    context("on Linux", () => {
      beforeEach(() => {
        sandbox.stub(process, "platform").value("linux");
      });
      afterEach(() => {
        sandbox.restore();
      });
      it("should return true", () => {
        import_chai.assert.isTrue(Settings.isHideMenuBarSupported());
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdHMvdGVzdC90eXBlcy9TZXR0aW5nc190ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IFNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gJ2NoYWknO1xuXG5pbXBvcnQgKiBhcyBTZXR0aW5ncyBmcm9tICcuLi8uLi8uLi90cy90eXBlcy9TZXR0aW5ncyc7XG5cbmRlc2NyaWJlKCdTZXR0aW5ncycsICgpID0+IHtcbiAgY29uc3Qgc2FuZGJveCA9IFNpbm9uLmNyZWF0ZVNhbmRib3goKTtcblxuICBkZXNjcmliZSgnaXNBdWRpb05vdGlmaWNhdGlvblN1cHBvcnRlZCcsICgpID0+IHtcbiAgICBjb250ZXh0KCdvbiBtYWNPUycsICgpID0+IHtcbiAgICAgIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgICAgICBzYW5kYm94LnN0dWIocHJvY2VzcywgJ3BsYXRmb3JtJykudmFsdWUoJ2RhcndpbicpO1xuICAgICAgfSk7XG5cbiAgICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICAgIHNhbmRib3gucmVzdG9yZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgcmV0dXJuIHRydWUnLCAoKSA9PiB7XG4gICAgICAgIGFzc2VydC5pc1RydWUoU2V0dGluZ3MuaXNBdWRpb05vdGlmaWNhdGlvblN1cHBvcnRlZCgpKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29udGV4dCgnb24gV2luZG93cycsICgpID0+IHtcbiAgICAgIGNvbnRleHQoJ3ZlcnNpb24gNycsICgpID0+IHtcbiAgICAgICAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgICAgICAgc2FuZGJveC5zdHViKHByb2Nlc3MsICdwbGF0Zm9ybScpLnZhbHVlKCd3aW4zMicpO1xuICAgICAgICAgIHNhbmRib3guc3R1YihvcywgJ3JlbGVhc2UnKS5yZXR1cm5zKCc3LjAuMCcpO1xuICAgICAgICB9KTtcblxuICAgICAgICBhZnRlckVhY2goKCkgPT4ge1xuICAgICAgICAgIHNhbmRib3gucmVzdG9yZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBpdCgnc2hvdWxkIHJldHVybiBmYWxzZScsICgpID0+IHtcbiAgICAgICAgICBhc3NlcnQuaXNGYWxzZShTZXR0aW5ncy5pc0F1ZGlvTm90aWZpY2F0aW9uU3VwcG9ydGVkKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBjb250ZXh0KCd2ZXJzaW9uIDgrJywgKCkgPT4ge1xuICAgICAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgICAgICBzYW5kYm94LnN0dWIocHJvY2VzcywgJ3BsYXRmb3JtJykudmFsdWUoJ3dpbjMyJyk7XG4gICAgICAgICAgc2FuZGJveC5zdHViKG9zLCAncmVsZWFzZScpLnJldHVybnMoJzguMC4wJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICAgICAgc2FuZGJveC5yZXN0b3JlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGl0KCdzaG91bGQgcmV0dXJuIHRydWUnLCAoKSA9PiB7XG4gICAgICAgICAgYXNzZXJ0LmlzVHJ1ZShTZXR0aW5ncy5pc0F1ZGlvTm90aWZpY2F0aW9uU3VwcG9ydGVkKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29udGV4dCgnb24gTGludXgnLCAoKSA9PiB7XG4gICAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgICAgc2FuZGJveC5zdHViKHByb2Nlc3MsICdwbGF0Zm9ybScpLnZhbHVlKCdsaW51eCcpO1xuICAgICAgfSk7XG5cbiAgICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICAgIHNhbmRib3gucmVzdG9yZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgcmV0dXJuIGZhbHNlJywgKCkgPT4ge1xuICAgICAgICBhc3NlcnQuaXNGYWxzZShTZXR0aW5ncy5pc0F1ZGlvTm90aWZpY2F0aW9uU3VwcG9ydGVkKCkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdpc05vdGlmaWNhdGlvbkdyb3VwaW5nU3VwcG9ydGVkJywgKCkgPT4ge1xuICAgIGNvbnRleHQoJ29uIG1hY09TJywgKCkgPT4ge1xuICAgICAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgICAgIHNhbmRib3guc3R1Yihwcm9jZXNzLCAncGxhdGZvcm0nKS52YWx1ZSgnZGFyd2luJyk7XG4gICAgICB9KTtcblxuICAgICAgYWZ0ZXJFYWNoKCgpID0+IHtcbiAgICAgICAgc2FuZGJveC5yZXN0b3JlKCk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCByZXR1cm4gdHJ1ZScsICgpID0+IHtcbiAgICAgICAgYXNzZXJ0LmlzVHJ1ZShTZXR0aW5ncy5pc05vdGlmaWNhdGlvbkdyb3VwaW5nU3VwcG9ydGVkKCkpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb250ZXh0KCdvbiBXaW5kb3dzJywgKCkgPT4ge1xuICAgICAgY29udGV4dCgndmVyc2lvbiA3JywgKCkgPT4ge1xuICAgICAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgICAgICBzYW5kYm94LnN0dWIocHJvY2VzcywgJ3BsYXRmb3JtJykudmFsdWUoJ3dpbjMyJyk7XG4gICAgICAgICAgc2FuZGJveC5zdHViKG9zLCAncmVsZWFzZScpLnJldHVybnMoJzcuMC4wJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICAgICAgc2FuZGJveC5yZXN0b3JlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGl0KCdzaG91bGQgcmV0dXJuIGZhbHNlJywgKCkgPT4ge1xuICAgICAgICAgIGFzc2VydC5pc0ZhbHNlKFNldHRpbmdzLmlzTm90aWZpY2F0aW9uR3JvdXBpbmdTdXBwb3J0ZWQoKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnRleHQoJ3ZlcnNpb24gOCsnLCAoKSA9PiB7XG4gICAgICAgIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgICAgICAgIHNhbmRib3guc3R1Yihwcm9jZXNzLCAncGxhdGZvcm0nKS52YWx1ZSgnd2luMzInKTtcbiAgICAgICAgICBzYW5kYm94LnN0dWIob3MsICdyZWxlYXNlJykucmV0dXJucygnOC4wLjAnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYWZ0ZXJFYWNoKCgpID0+IHtcbiAgICAgICAgICBzYW5kYm94LnJlc3RvcmUoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaXQoJ3Nob3VsZCByZXR1cm4gdHJ1ZScsICgpID0+IHtcbiAgICAgICAgICBhc3NlcnQuaXNUcnVlKFNldHRpbmdzLmlzTm90aWZpY2F0aW9uR3JvdXBpbmdTdXBwb3J0ZWQoKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb250ZXh0KCdvbiBMaW51eCcsICgpID0+IHtcbiAgICAgIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgICAgICBzYW5kYm94LnN0dWIocHJvY2VzcywgJ3BsYXRmb3JtJykudmFsdWUoJ2xpbnV4Jyk7XG4gICAgICB9KTtcblxuICAgICAgYWZ0ZXJFYWNoKCgpID0+IHtcbiAgICAgICAgc2FuZGJveC5yZXN0b3JlKCk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCByZXR1cm4gdHJ1ZScsICgpID0+IHtcbiAgICAgICAgYXNzZXJ0LmlzVHJ1ZShTZXR0aW5ncy5pc05vdGlmaWNhdGlvbkdyb3VwaW5nU3VwcG9ydGVkKCkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuICBkZXNjcmliZSgnaXNIaWRlTWVudUJhclN1cHBvcnRlZCcsICgpID0+IHtcbiAgICBjb250ZXh0KCdvbiBtYWNPUycsICgpID0+IHtcbiAgICAgIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgICAgICBzYW5kYm94LnN0dWIocHJvY2VzcywgJ3BsYXRmb3JtJykudmFsdWUoJ2RhcndpbicpO1xuICAgICAgfSk7XG5cbiAgICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICAgIHNhbmRib3gucmVzdG9yZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgcmV0dXJuIGZhbHNlJywgKCkgPT4ge1xuICAgICAgICBhc3NlcnQuaXNGYWxzZShTZXR0aW5ncy5pc0hpZGVNZW51QmFyU3VwcG9ydGVkKCkpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb250ZXh0KCdvbiBXaW5kb3dzJywgKCkgPT4ge1xuICAgICAgY29udGV4dCgndmVyc2lvbiA3JywgKCkgPT4ge1xuICAgICAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgICAgICBzYW5kYm94LnN0dWIocHJvY2VzcywgJ3BsYXRmb3JtJykudmFsdWUoJ3dpbjMyJyk7XG4gICAgICAgICAgc2FuZGJveC5zdHViKG9zLCAncmVsZWFzZScpLnJldHVybnMoJzcuMC4wJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICAgICAgc2FuZGJveC5yZXN0b3JlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGl0KCdzaG91bGQgcmV0dXJuIHRydWUnLCAoKSA9PiB7XG4gICAgICAgICAgYXNzZXJ0LmlzVHJ1ZShTZXR0aW5ncy5pc0hpZGVNZW51QmFyU3VwcG9ydGVkKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBjb250ZXh0KCd2ZXJzaW9uIDgrJywgKCkgPT4ge1xuICAgICAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgICAgICBzYW5kYm94LnN0dWIocHJvY2VzcywgJ3BsYXRmb3JtJykudmFsdWUoJ3dpbjMyJyk7XG4gICAgICAgICAgc2FuZGJveC5zdHViKG9zLCAncmVsZWFzZScpLnJldHVybnMoJzguMC4wJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICAgICAgc2FuZGJveC5yZXN0b3JlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGl0KCdzaG91bGQgcmV0dXJuIHRydWUnLCAoKSA9PiB7XG4gICAgICAgICAgYXNzZXJ0LmlzVHJ1ZShTZXR0aW5ncy5pc0hpZGVNZW51QmFyU3VwcG9ydGVkKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29udGV4dCgnb24gTGludXgnLCAoKSA9PiB7XG4gICAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgICAgc2FuZGJveC5zdHViKHByb2Nlc3MsICdwbGF0Zm9ybScpLnZhbHVlKCdsaW51eCcpO1xuICAgICAgfSk7XG5cbiAgICAgIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgICAgIHNhbmRib3gucmVzdG9yZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgcmV0dXJuIHRydWUnLCAoKSA9PiB7XG4gICAgICAgIGFzc2VydC5pc1RydWUoU2V0dGluZ3MuaXNIaWRlTWVudUJhclN1cHBvcnRlZCgpKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsZ0JBQWU7QUFDZixtQkFBa0I7QUFDbEIsa0JBQXVCO0FBRXZCLGVBQTBCO0FBRTFCLFNBQVMsWUFBWSxNQUFNO0FBQ3pCLFFBQU0sVUFBVSxxQkFBTSxjQUFjO0FBRXBDLFdBQVMsZ0NBQWdDLE1BQU07QUFDN0MsWUFBUSxZQUFZLE1BQU07QUFDeEIsaUJBQVcsTUFBTTtBQUNmLGdCQUFRLEtBQUssU0FBUyxVQUFVLEVBQUUsTUFBTSxRQUFRO0FBQUEsTUFDbEQsQ0FBQztBQUVELGdCQUFVLE1BQU07QUFDZCxnQkFBUSxRQUFRO0FBQUEsTUFDbEIsQ0FBQztBQUVELFNBQUcsc0JBQXNCLE1BQU07QUFDN0IsMkJBQU8sT0FBTyxTQUFTLDZCQUE2QixDQUFDO0FBQUEsTUFDdkQsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUVELFlBQVEsY0FBYyxNQUFNO0FBQzFCLGNB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
