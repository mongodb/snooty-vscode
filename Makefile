FRONTEND_DIR=snooty-frontend
ENV_PROD=.env.production

frontend:
	git submodule init
	git submodule update
	touch ${FRONTEND_DIR}/${ENV_PROD}
	cd ${FRONTEND_DIR} && ${MAKE} static
	cd ${FRONTEND_DIR} && npm install --only=production
