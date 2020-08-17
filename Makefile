clean:
	rm -rf snippets
	rm -f scripts/rstspec.toml
	-rm install.*
	-rm -r .snooty

snippets:
	curl -SfL https://raw.githubusercontent.com/mongodb/snooty-parser/master/snooty/rstspec.toml -o scripts/rstspec.toml
	mkdir snippets
	python3 scripts/snippet-generator.py
