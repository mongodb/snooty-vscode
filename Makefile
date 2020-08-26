.PHONY: clean snippets lint

lint:
	for url in `python3 -c 'import json; print(" ".join(json.load(open("package.json"))["runtimeDependencies"][0]["platforms"].values()))'`; do \
		echo "$${url}"; \
		curl -sI "$${url}" | grep -F '302 Found'; \
	done

clean:
	rm -rf snippets
	rm -f scripts/rstspec.toml
	-rm install.*
	-rm -r .snooty

snippets:
	curl -SfL https://raw.githubusercontent.com/mongodb/snooty-parser/master/snooty/rstspec.toml -o scripts/rstspec.toml
	mkdir snippets
	python3 scripts/snippet-generator.py
