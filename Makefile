FRONTEND_DIR=snooty-frontend
ENV_PROD=.env.production

frontend:
	git submodule init
	git submodule update
	touch ${FRONTEND_DIR}/${ENV_PROD}
	cd ${FRONTEND_DIR} && ${MAKE} static
	cd ${FRONTEND_DIR} && npm install --only=production

clean:
	rm -rf snippets
	rm -f scripts/rstspec.toml

snippets:
	curl -SfL https://raw.githubusercontent.com/mongodb/snooty-parser/master/snooty/rstspec.toml -o scripts/rstspec.toml
	mkdir snippets
	python3 scripts/snippet-generator.py 
