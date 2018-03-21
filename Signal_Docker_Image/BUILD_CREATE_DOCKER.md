To build run this instruction in the root directory

docker build -t signal_image -f Signal_Docker_Image/Dockerfile .

To generate a build run

docker run signal_image yarn build-release

To pull releases

docker cp $(docker ps -l --format '{{.Names}}'):/app/release .

This pulls the release folder from the container. Within the container is a 
copy of a deb, a snap and zip for linux releases.
        


