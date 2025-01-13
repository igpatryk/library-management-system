# frontend/Dockerfile
FROM node:16

WORKDIR /app

# These webpack deprecation warnings are coming from react-scripts@5.0.1
# They are harmless and will be fixed in future versions of react-scripts
# See: https://github.com/facebook/create-react-app/issues/11879
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "NODE_NO_WARNINGS=1 FAST_REFRESH=false WATCHPACK_POLLING=true npm start"]